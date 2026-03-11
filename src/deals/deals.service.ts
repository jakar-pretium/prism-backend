import { Injectable, NotFoundException } from '@nestjs/common';
import { SnowflakeService } from 'src/services/snowflake/snowflake.service';
import { Binds } from 'snowflake-sdk';
import { v4 as uuidv4 } from 'uuid';
import { MapboxService } from 'src/services/mapbox/mapbox.service';
import { Deal, DealReportStatus, PrismaClient } from "@prisma/client";
const client = new PrismaClient();
import { InternalServerErrorException } from '@nestjs/common';
import { CreateAnchorDealReportDto } from './deals.dto';

@Injectable()
export class DealsService {
    constructor(private readonly snowflakeService: SnowflakeService, private readonly mapboxService: MapboxService) { }

    async handleAnchorDealReport(deal: CreateAnchorDealReportDto, user_sub_id: string) {
        let deal_id = uuidv4();

        try {
            // add underscore to deal name and make all lowercase
            const deal_name = deal.address.replace(/ /g, "_").toUpperCase();

            // check if address is present
            if (deal.latitude === null || deal.longitude === null) {
                // fetch property from parcl labs or mapbox
                const property = await this.mapboxService.geocode(`${deal.address}, ${deal.city}, ${deal.state}, ${deal.zip_code}`);

                if (!property) {
                    throw new NotFoundException("Property not found");
                }

                deal.latitude = property.properties.coordinates.latitude;
                deal.longitude = property.properties.coordinates.longitude;
            } else {
                // reverse geocode the latitude and longitude to get the address
                const address = await this.mapboxService.reverseGeocode(deal.latitude?.toString() ?? "0", deal.longitude?.toString() ?? "0");
                if (address) {
                    console.log("ADDRESS", address);
                    deal.address = address.address;
                    deal.city = address.city;
                    deal.state = address.state;
                    deal.zip_code = address.zip;
                }
            }

            // Create deal in pg database
            const db_deal = await client.deal.create({
                data: { ...deal, user_sub_id: user_sub_id, id: deal_id, deal_name: deal_name },
            });

            // create deal report
            await client.dealReport.create({
                data: {
                    dealId: db_deal.id,
                    status: "in_progress",
                },
            });

            // get the exact cell for the latitude and longitude
            const exactCellQuery = `
                SELECT H3_INT_TO_STRING(H3_LATLNG_TO_CELL(:1, :2, 6)) AS h3_6
            `;
            const exactCellBinds: Binds = [deal.latitude ?? 0, deal.longitude ?? 0];
            const exactCellResult = await this.snowflakeService.executeQuery(exactCellQuery, exactCellBinds);
            const exactCell = exactCellResult[0].H3_6;

            // GET THE H3-6 LEVEL INDEXES
            const query = `
                SELECT H3_INT_TO_STRING(VALUE) AS h3_6
                FROM TABLE(
                    FLATTEN(
                        INPUT => H3_GRID_DISK(
                            H3_LATLNG_TO_CELL(:1, :2, 6),
                            2
                        )
                    )
                );
            `;

            const binds: Binds = [deal.longitude ?? 0, deal.latitude ?? 0]; // NOTE: ST_POINT expects (lng, lat)

            const h3Cells_6_results = await this.snowflakeService.executeQuery(query, binds);
            const h3Cells = h3Cells_6_results.map((row: any) => row.H3_6);

            const placeholders = h3Cells.map((_, i) => `:${i + 1}`).join(",");

            // HOUSING METRICS (last 2 years)
            const housingMetricsH3_6Query = `
            SELECT
                *
            FROM
                TRANSFORM_PROD.FACT.FACT_H3_6_HOUSING_METRICS
            WHERE
                GEO_ID = :1 AND PROPERTY_TYPE = 'Single Family Residential'
                AND DATE_REFERENCE >= DATEADD(YEAR, -2, CURRENT_DATE())
            `;

            const housingMetricsBinds: Binds = [exactCell];

            const housingMetricsH3_6Results = await this.snowflakeService.executeQuery(
                housingMetricsH3_6Query,
                housingMetricsBinds
            );

            type HousingMarketTimeseriesRow = {
                date: string | undefined;
                geo_id: string;
                geo_level_code: string;
                property_type: string;
                median_sale_price: number;
                months_of_supply: number;
                median_dom: number;
            };

            let housingMarketTimeseries: HousingMarketTimeseriesRow[] = [];


            housingMarketTimeseries.push(...housingMetricsH3_6Results.map((row: any) => ({
                date: row.DATE_REFERENCE?.toISOString().split("T")[0], // YYYY-MM-DD
                geo_id: row.GEO_ID,
                geo_level_code: row.GEO_LEVEL_CODE,
                property_type: row.PROPERTY_TYPE,
                median_sale_price: row.MEDIAN_SALE_PRICE,
                months_of_supply: row.MONTHS_OF_SUPPLY,
                median_dom: row.MEDIAN_DOM,
            })));


            // get the latest date from the housingMarketTimeseries
            let latestMedianSalePrice = 0;
            let latestMonthsOfSupply = 0;
            let latestMedianDom = 0;

            if (housingMarketTimeseries.length > 0) {
                const latestDate = housingMarketTimeseries.reduce((max: string, row: any) => {
                    return new Date(row.date) > new Date(max) ? row.date : max;
                }, housingMarketTimeseries[0].date);

                // get the housingMarketTimeseries for the latest date
                const latestHousingMarketTimeseries = housingMarketTimeseries.filter((row: any) => row.date === latestDate);

                // get the median sale price for the latest date
                latestMedianSalePrice = latestHousingMarketTimeseries.reduce((sum: number, row: any) => sum + row.median_sale_price, 0) / latestHousingMarketTimeseries.length;
                latestMonthsOfSupply = latestHousingMarketTimeseries.reduce((sum: number, row: any) => sum + row.months_of_supply, 0) / latestHousingMarketTimeseries.length;
                latestMedianDom = latestHousingMarketTimeseries.reduce((sum: number, row: any) => sum + row.median_dom, 0) / latestHousingMarketTimeseries.length;
            }


            // BUILDER METRICS
            const buildersH3_6Query = `
                SELECT *
                FROM (
                    SELECT
                        *,
                        2 * 3959 * ASIN(
                            SQRT(
                                POWER(SIN(RADIANS(LATITUDE::FLOAT - :1) / 2), 2) +
                                COS(RADIANS(:1)) *
                                COS(RADIANS(LATITUDE::FLOAT)) *
                                POWER(SIN(RADIANS(LONGITUDE::FLOAT - :2) / 2), 2)
                            )
                        ) AS distance_miles
            
                    FROM DS_SOURCE_PROD_TPANALYTICS.TPANALYTICS_SHARE.ZONDA_BTR_COMPREHENSIVE
            
                    WHERE LATITUDE IS NOT NULL
                    AND LONGITUDE IS NOT NULL
                    AND BUILDERNAME IS NOT NULL
                ) t
                WHERE distance_miles <= 10
                ORDER BY distance_miles;
            `;
            const buildersH3_6Binds: Binds = [deal.latitude ?? 0, deal.longitude ?? 0];

            const buildersH3_6Results = await this.snowflakeService.executeQuery(buildersH3_6Query, buildersH3_6Binds);

            let cleanedBuildersH3_6Results: any[] = [];

            cleanedBuildersH3_6Results.push(...buildersH3_6Results.map((row: any) => ({
                builder_name: row.BUILDERNAME,
                builder_lat: row.LATITUDE,
                builder_lng: row.LONGITUDE,
                name: row.NAME,
                operator_manager_name: row.OPERATORMANAGERNAME,
                status: row.STATUS,
                project_address: row.PROJECTADDRESS,
                developer_name: row.DEVELOPERNAME,
                product_type: row.PRODUCTTYPE,
                unit_size_avg: row.UNITSIZEAVG,
                rent_avg: row.RENTAVG,
                construction_start_date: row.CONSTRUCTIONSTARTDATE,
                construction_end_date: row.CONSTRUCTIONENDDATE,
                leasing_start_date: row.LEASINGSTARTDATE,
            })));

            // CRIME + SCHOOL METRICS
            const crimeSchoolsH3_6Query = `
                SELECT
                    *,
                    PERCENT_RANK() OVER (ORDER BY SCHOOL_SCORE)  AS SCHOOL_SCORE_PCTL,
                    PERCENT_RANK() OVER (ORDER BY CRIME_SCORE)   AS CRIME_SCORE_PCTL
                FROM
                    TRANSFORM_PROD.FACT.FACT_H3_6_CRIME_SCHOOLS
                WHERE
                    GEO_ID IN (${placeholders})
                QUALIFY
                    ROW_NUMBER() OVER (
                        PARTITION BY GEO_ID
                        ORDER BY DATE_REFERENCE DESC
                    ) = 1
            `;

            const crimeSchoolsH3_6Binds: Binds = h3Cells;

            const crimeSchoolsH3_6Results = await this.snowflakeService.executeQuery(
                crimeSchoolsH3_6Query,
                crimeSchoolsH3_6Binds
            );

            // clean the crimeSchoolsH3_6Results
            type CrimeSchoolRow = {
                geo_id: string;
                geo_level_code: string;
                date: string | undefined;
                crime_score: number;
                school_score: number;
                school_score_pctl: number;
                crime_score_pctl: number;
            };

            let cleanedCrimeSchoolsH3_6Results: CrimeSchoolRow[] = [];
            cleanedCrimeSchoolsH3_6Results.push(...crimeSchoolsH3_6Results.map((row: any) => ({
                geo_id: row.GEO_ID,
                geo_level_code: row.GEO_LEVEL_CODE,
                date: row.DATE_REFERENCE?.toISOString().split("T")[0], // YYYY-MM-DD
                crime_score: row.CRIME_SCORE,
                school_score: row.SCHOOL_SCORE,
                school_score_pctl: row.SCHOOL_SCORE_PCTL,
                crime_score_pctl: row.CRIME_SCORE_PCTL,
            })));

            // RETAILER METRICS
            const housingRetailersH3_6Query = `
                WITH base AS (
                    SELECT
                        PRIMARY_CATEGORY,
                        LATITUDE,
                        LONGITUDE,
                        RETAILER_NAME,
                        ST_DISTANCE(
                            ST_POINT(LONGITUDE, LATITUDE),
                            ST_POINT(:1, :2)
                        ) AS distance_meters
                    FROM TRANSFORM_PROD.FACT.FACT_H3_6_RETAILERS
                    WHERE LATITUDE IS NOT NULL
                    AND LONGITUDE IS NOT NULL
                )
                SELECT *
                FROM base
                WHERE distance_meters <= 8046.72
                ORDER BY distance_meters;
            `;

            const housingRetailersH3_6Binds: Binds = [deal.longitude ?? 0, deal.latitude ?? 0];

            // execute the query
            const housingRetailersH3_6Results = await this.snowflakeService.executeQuery(housingRetailersH3_6Query, housingRetailersH3_6Binds);

            const finalResult = {
                housingMarketTimeseries: { source: 'REDFIN', results: housingMarketTimeseries },
                housingMetrics: { source: 'REDFIN', latestMedianSalePrice, latestMonthsOfSupply, latestMedianDom },
                crimeAndSchools: { source: 'MARKERR', results: cleanedCrimeSchoolsH3_6Results },
                retailers: { source: 'OVERTURE MAPS PLACES', results: housingRetailersH3_6Results },
                builders: { source: 'ZONDA', results: cleanedBuildersH3_6Results },
            }

            // update report status
            await client.dealReport.update({
                where: { dealId: deal_id },
                data: { status: "completed", report: finalResult },
            });

            return finalResult;
        } catch (err) {
            console.error(err);
            // update report status
            await client.dealReport.update({
                where: { dealId: deal_id },
                data: { status: "failed" },
            });
        }
    }

    async getAnchorDeals(user_sub_id: string, user_email: string) {
        try {
            // check if the user email continas "@anchor.com"
            let deals: Deal[] = [];
            if (user_email?.includes("@anchorloans.com")) {
                // get all deals for users that have an email that contains "@anchor.com"
                deals = await client.deal.findMany({
                    where: {
                        user: {
                            email: {
                                contains: "@anchorloans.com",
                            },
                        },
                    },
                    include: {
                        dealReport: true,
                    },
                });
            } else {
                deals = await client.deal.findMany({
                    where: {
                        user_sub_id: user_sub_id,
                    },
                    include: {
                        dealReport: true,
                    },
                });
            }

            return deals;

        } catch (err) {
            console.error(err);
            throw new InternalServerErrorException("Failed to get deals");
        }
    }

}