import { Injectable } from '@nestjs/common';
import { Binds } from 'snowflake-sdk';
import { SnowflakeService } from 'src/services/snowflake/snowflake.service';

@Injectable()
export class MsaBtrService {
    constructor(private readonly snowflakeService: SnowflakeService) { }

    async getBuilderMetrics() {
        // BUILDER METRICS
        const builderMetricsQuery = `
            WITH base AS (
                SELECT *
                FROM TRANSFORM_PROD.CLEANED.ZONDA_BTR_PROJECTS
            ),

            cbsa_agg AS (
                SELECT
                    CBSA_NAME,

                    /* ===== Core metrics ===== */
                    COUNT(DISTINCT PROJECT_ID) AS PROJECT_COUNT,
                    SUM(TOTAL_UNITS) AS TOTAL_UNITS,

                    SUM(OCCUPIED_UNITS) / NULLIF(SUM(TOTAL_UNITS), 0) AS AVG_OCCUPANCY_PCT,

                    AVG(TRY_TO_NUMBER(AVG_RENT::VARCHAR, 18, 4)) AS AVG_RENT_PER_UNIT,
                    AVG(TRY_TO_NUMBER(RENT_PER_SQFT::VARCHAR, 18, 4)) AS AVG_RENT_PER_SQFT,
                    AVG(TRY_TO_NUMBER(AVG_UNIT_SQFT::VARCHAR, 18, 4)) AS AVG_UNIT_SQFT,

                    SUM(IFF(STATUS = 'Under Construction', TOTAL_UNITS, 0)) AS UC_UNITS,
                    SUM(IFF(STATUS = 'Planned', TOTAL_UNITS, 0)) AS PLANNED_UNITS,

                    COUNT(DISTINCT IFF(BUILDER_NAME IS NULL OR BUILDER_NAME = 'Unknown', NULL, BUILDER_NAME))
                        AS ACTIVE_BUILDERS,

                    /* ===== “New query” metrics ===== */
                    COUNT(DISTINCT PROJECT_NAME) AS COMMUNITIES,

                    SUM(IFF(STATUS = 'Completed', 1, 0)) AS DELIVERED,
                    SUM(IFF(STATUS = 'Under Construction', 1, 0)) AS UNDER_CONSTRUCTION_ROWS,
                    SUM(IFF(STATUS = 'Planned', 1, 0)) AS PLANNED_ROWS,

                    SUM(IFF(LEASING_STATUS = 'Not Leasing', 1, 0)) AS RAMPING,
                    SUM(IFF(LEASING_STATUS = 'Stabilized', 1, 0)) AS STABILIZED,
                    SUM(IFF(LEASING_STATUS = 'Lease-Up', 1, 0)) AS LEASE_UP

                FROM base
                GROUP BY CBSA_NAME
            ),

            /* Top Builder (by project count) per CBSA */
            builder_rank AS (
                SELECT
                    CBSA_NAME,
                    BUILDER_NAME,
                    COUNT(DISTINCT PROJECT_ID) AS BUILDER_PROJECTS,
                    ROW_NUMBER() OVER (
                        PARTITION BY CBSA_NAME
                        ORDER BY COUNT(DISTINCT PROJECT_ID) DESC
                    ) AS RN
                FROM base
                WHERE BUILDER_NAME IS NOT NULL
                AND BUILDER_NAME <> 'Unknown'
                GROUP BY CBSA_NAME, BUILDER_NAME
            ),

            top_builder AS (
                SELECT
                    CBSA_NAME,
                    BUILDER_NAME AS TOP_BUILDER,
                    BUILDER_PROJECTS
                FROM builder_rank
                WHERE RN = 1
            ),

            /* Top 10 builders by UNIT COUNT per CBSA */
            builder_units_ranked AS (
                SELECT
                    CBSA_NAME,
                    BUILDER_NAME,
                    SUM(COALESCE(TOTAL_UNITS, 0)) AS UNITS,
                    ROW_NUMBER() OVER (
                        PARTITION BY CBSA_NAME
                        ORDER BY SUM(COALESCE(TOTAL_UNITS, 0)) DESC, BUILDER_NAME
                    ) AS RN
                FROM base
                WHERE BUILDER_NAME IS NOT NULL
                AND BUILDER_NAME <> 'Unknown'
                GROUP BY CBSA_NAME, BUILDER_NAME
            ),

            top_operators AS (
                SELECT
                    CBSA_NAME,
                    ARRAY_AGG(
                        OBJECT_CONSTRUCT(
                            'BUILDER_NAME', BUILDER_NAME,
                            'UNITS', UNITS
                        )
                    ) WITHIN GROUP (ORDER BY UNITS DESC) AS TOP_OPERATORS
                FROM builder_units_ranked
                WHERE RN <= 10
                GROUP BY CBSA_NAME
            )

            SELECT
                a.CBSA_NAME,
                a.PROJECT_COUNT,
                a.TOTAL_UNITS,
                a.COMMUNITIES,

                a.DELIVERED,
                a.UNDER_CONSTRUCTION_ROWS,
                a.PLANNED_ROWS,

                a.AVG_OCCUPANCY_PCT,
                a.AVG_RENT_PER_UNIT,
                a.AVG_RENT_PER_SQFT,
                a.AVG_UNIT_SQFT,

                a.UC_UNITS,
                a.PLANNED_UNITS,

                a.ACTIVE_BUILDERS,

                a.RAMPING,
                a.STABILIZED,
                a.LEASE_UP,

                b.TOP_BUILDER,
                b.BUILDER_PROJECTS AS TOP_BUILDER_PROJECT_COUNT,

                o.TOP_OPERATORS

            FROM cbsa_agg a
            LEFT JOIN top_builder b
                ON a.CBSA_NAME = b.CBSA_NAME
            LEFT JOIN top_operators o
                ON a.CBSA_NAME = o.CBSA_NAME
            ORDER BY a.TOTAL_UNITS DESC;
        `;

        const builderMetricsResults = await this.snowflakeService.executeQuery(builderMetricsQuery);

        return builderMetricsResults;
    }

    async getProjects(metros: string[]) {
        const metroPlaceholders = metros
            .map((_, idx) => `:${idx + 1}`)
            .join(", ");

        const builderMapDataQuery = `
            WITH latest AS (
                SELECT *
                FROM (
                    SELECT
                        CBSA_NAME AS METRO,
                        PROJECT_ID,
                        PROJECT_NAME,
                        BUILDER_NAME,
                        STATUS,
                        LATITUDE,
                        LONGITUDE,
                        TOTAL_UNITS,

                        /* Safe numeric conversions */
                        TRY_TO_NUMBER(OCCUPANCY_PCT::VARCHAR, 18, 4)  AS OCC_PCT,
                        TRY_TO_NUMBER(AVG_RENT::VARCHAR, 18, 2)       AS RENT,
                        TRY_TO_NUMBER(RENT_PER_SQFT::VARCHAR, 18, 4)  AS RPSF,
                        TRY_TO_NUMBER(AVG_UNIT_SQFT::VARCHAR, 18, 2)  AS AVG_SF,

                        DATE_REFERENCE,

                        ROW_NUMBER() OVER (
                            PARTITION BY PROJECT_ID
                            ORDER BY DATE_REFERENCE DESC
                        ) AS RN

                    FROM TRANSFORM_PROD.CLEANED.ZONDA_BTR_PROJECTS
                    WHERE LATITUDE IS NOT NULL
                    AND LONGITUDE IS NOT NULL
                )
                WHERE RN = 1
            )

            SELECT
                METRO,
                PROJECT_ID      AS ID,
                PROJECT_NAME    AS NAME,
                COALESCE(BUILDER_NAME, 'Unknown') AS BUILDER,
                STATUS,
                LATITUDE        AS LAT,
                LONGITUDE       AS LON,
                TOTAL_UNITS     AS UNITS,
                OCC_PCT,
                RENT,
                RPSF,
                AVG_SF

            FROM latest
            WHERE METRO IN (${metroPlaceholders})
            ORDER BY METRO, UNITS DESC;
        `;

        const binds: Binds = metros;

        const builderMapDataResults = await this.snowflakeService.executeQuery(builderMapDataQuery, binds);

        return builderMapDataResults;
    }
}