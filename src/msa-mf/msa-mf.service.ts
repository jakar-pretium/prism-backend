import { Injectable } from '@nestjs/common';
import { Binds } from 'snowflake-sdk';
import { SnowflakeService } from 'src/services/snowflake/snowflake.service';

@Injectable()
export class MsaMfService {
    constructor(private readonly snowflakeService: SnowflakeService) { }

    async getMultifamilyData(metros: string[]) {
        const metroPlaceholders = metros.map((_, idx) => `:${idx + 1}`).join(", ");

        const query = `
            SELECT
                MSA,
                DATE,
                BEDROOM_CATEGORY,
                CLASS_CATEGORY,
                AVG(RENT_ASKING)                AS AVG_ASKING_RENT,
                AVG(RENT_EFFECTIVE)             AS AVG_EFFECTIVE_RENT,
                AVG(RENT_EFFECTIVE_PER_SQFT)    AS AVG_EFF_RENT_PSF,
                AVG(VACANCY)                    AS AVG_VACANCY,
                AVG(RENT_CONCESSION)            AS AVG_CONCESSION,
                COUNT(DISTINCT PROPERTY_ID)     AS PROPERTY_COUNT,
                SUM(UNITS_TOTAL)                AS TOTAL_UNITS,
                SUM(UNITS_0BR)                  AS UNITS_STUDIO,
                SUM(UNITS_1BR)                  AS UNITS_1BR,
                SUM(UNITS_2BR)                  AS UNITS_2BR,
                SUM(UNITS_3BR_OR_MORE)          AS UNITS_3BR_PLUS
            FROM TRANSFORM.MARKERR.RENT_PROPERTY
            WHERE MSA IN (${metroPlaceholders})
            AND BEDROOM_CATEGORY != 'Any'
            AND CLASS_CATEGORY IS NOT NULL
            AND DATE >= DATEADD(day, -30, (SELECT MAX(DATE) FROM TRANSFORM.MARKERR.RENT_PROPERTY))
            AND DATE <= (SELECT MAX(DATE) FROM TRANSFORM.MARKERR.RENT_PROPERTY)
            GROUP BY 1,2,3,4
            ORDER BY MSA, BEDROOM_CATEGORY,
                CASE CLASS_CATEGORY
                    WHEN 'A++' THEN 1 WHEN 'A' THEN 2
                    WHEN 'B'   THEN 3 WHEN 'C' THEN 4 ELSE 5
                END;
        `;

        const binds: Binds = metros;

        const multifamily = await this.snowflakeService.executeQuery(query, binds);

        // get min and max date from the multifamily data
        const minDate = multifamily.reduce((min: string, row: any) => {
            return new Date(row.DATE) < new Date(min) ? row.DATE : min;
        }, multifamily[0].DATE);
        const maxDate = multifamily.reduce((max: string, row: any) => {
            return new Date(row.DATE) > new Date(max) ? row.DATE : max;
        }, multifamily[0].DATE);


        return {
            multifamily,
            minDate,
            maxDate,
        };
    }

    async getAllMSAs() {
        const query = `
            SELECT DISTINCT MSA
            FROM TRANSFORM.MARKERR.RENT_PROPERTY
            WHERE DATE >= DATEADD(
                        month,
                        -2,
                        (SELECT MAX(DATE) FROM TRANSFORM.MARKERR.RENT_PROPERTY)
                )
            ORDER BY MSA;
        `;

        const multifamily = await this.snowflakeService.executeQuery(query);

        return multifamily;
    }

    async getMonthlyData(metros: string[], categories: string[], bedroomCategories: string[]) {
        const metroPlaceholders = metros.map((_, idx) => `:${idx + 1}`).join(", ");
        const binds: Binds = [...metros];
        const optionalFilters: string[] = [];

        if (categories.length > 0) {
            const categoryStartIndex = binds.length + 1;
            const categoryPlaceholders = categories
                .map((_, idx) => `:${categoryStartIndex + idx}`)
                .join(", ");

            optionalFilters.push(`AND CLASS_CATEGORY IN (${categoryPlaceholders})`);
            binds.push(...categories);
        }

        if (bedroomCategories.length > 0) {
            const bedroomCategoryStartIndex = binds.length + 1;
            const bedroomCategoryPlaceholders = bedroomCategories
                .map((_, idx) => `:${bedroomCategoryStartIndex + idx}`)
                .join(", ");

            optionalFilters.push(`AND BEDROOM_CATEGORY IN (${bedroomCategoryPlaceholders})`);
            binds.push(...bedroomCategories);
        }

        const query = `
            SELECT
                MSA,
                MONTH,
                BEDROOM_CATEGORY,
                AVG(AVG_ASKING_RENT)   AS AVG_ASKING_RENT,
                AVG(AVG_EFFECTIVE_RENT) AS AVG_EFFECTIVE_RENT,
                AVG(AVG_VACANCY)       AS AVG_VACANCY
            FROM TRANSFORM.MARKERR.RENT_PROPERTY_MONTHLY
            WHERE MSA IN (${metroPlaceholders})
            AND BEDROOM_CATEGORY != 'Any'
            AND CLASS_CATEGORY IS NOT NULL
            AND MONTH >= DATEADD('month', -12, DATE_TRUNC('month', CURRENT_DATE))
            ${optionalFilters.join("\n        ")}
            GROUP BY 1,2,3
            ORDER BY MSA, BEDROOM_CATEGORY, MONTH;
        `;

        const multifamily = await this.snowflakeService.executeQuery(query, binds);

        return multifamily;
    }
}