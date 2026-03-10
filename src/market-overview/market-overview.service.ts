import { Injectable } from '@nestjs/common';
import { SnowflakeService } from 'src/services/snowflake/snowflake.service';

@Injectable()
export class MarketOverviewService {
    constructor(private readonly snowflakeService: SnowflakeService) { }

    async getDropdownData(geoLevel: string) {
        // switch case for the geo level
        let query = "";

        switch (geoLevel) {
            case "county":
                query = `
                SELECT DISTINCT REGION
                FROM TRANSFORM.REDFIN.REDFIN_COUNTY_MARKET_TRACKER_LATEST
                WHERE REGION IS NOT NULL
                ORDER BY REGION;
                `;
                break;
            case "state":
                query = `
                SELECT DISTINCT REGION
                FROM TRANSFORM.REDFIN.REDFIN_STATE_MARKET_TRACKER_LATEST
                WHERE REGION IS NOT NULL
                ORDER BY REGION;
                `;
                break;
            case "city":
                query = `
                SELECT DISTINCT REGION
                FROM TRANSFORM.REDFIN.REDFIN_CITY_MARKET_TRACKER_LATEST
                WHERE REGION IS NOT NULL
                ORDER BY REGION;
                `;
                break;
            case "zip":
                query = `
                SELECT DISTINCT REGION
                FROM TRANSFORM.REDFIN.REDFIN_ZIPCODE_MARKET_TRACKER_LATEST
                WHERE REGION IS NOT NULL
                ORDER BY REGION;
                `;
                break;
            case "metro":
                query = `
                SELECT DISTINCT REGION
                FROM TRANSFORM.REDFIN.REDFIN_METRO_MARKET_TRACKER_LATEST
                WHERE REGION IS NOT NULL
                ORDER BY REGION;
                `;
                break;
            case "neighborhood":
                query = `
                SELECT DISTINCT REGION
                FROM TRANSFORM.REDFIN.REDFIN_NEIGHBORHOOD_MARKET_TRACKER_LATEST
                WHERE REGION IS NOT NULL
                ORDER BY REGION;
                `;
                break;
            default:
                throw new Error("Invalid geo level");
        }

        const result = await this.snowflakeService.executeQuery(query);

        const counties = result.map((row: any) => row.REGION);

        return counties;
    }

    async getMarketTrackerData(metric: string, propertyType: string, geoLevel: string, region: string) {
        let table = "";
        switch (geoLevel) {
            case "county":
                table = "TRANSFORM.REDFIN.REDFIN_COUNTY_MARKET_TRACKER_LATEST";
                break;
            case "state":
                table = "TRANSFORM.REDFIN.REDFIN_STATE_MARKET_TRACKER_LATEST";
                break;
            case "city":
                table = "TRANSFORM.REDFIN.REDFIN_CITY_MARKET_TRACKER_LATEST";
                break;
            case "zip":
                table = "TRANSFORM.REDFIN.REDFIN_ZIPCODE_MARKET_TRACKER_LATEST";
                break;
            case "metro":
                table = "TRANSFORM.REDFIN.REDFIN_METRO_MARKET_TRACKER_LATEST";
                break;
            case "neighborhood":
                table = "TRANSFORM.REDFIN.REDFIN_NEIGHBORHOOD_MARKET_TRACKER_LATEST";
                break;
            default:
                throw new Error("Invalid geo level");
        }

        const cleanMetric = metric.replace(/ /g, "_").toUpperCase();

        const query = `
            SELECT
                PERIOD_END AS DATE,
                ${cleanMetric} AS VALUE
            FROM ${table}
            WHERE PROPERTY_TYPE = ?
                AND REGION = ?
            ORDER BY PERIOD_END ASC;
        `;


        const binds = [propertyType, region];

        const result = await this.snowflakeService.executeQuery(query, binds);

        return result;
    }
}