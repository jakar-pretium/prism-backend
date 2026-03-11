import { Injectable } from '@nestjs/common';
import { MapboxService } from 'src/services/mapbox/mapbox.service';
import { ParclLabsService } from 'src/services/parcl-labs/parcl-labs.service';
import { SnowflakeService } from 'src/services/snowflake/snowflake.service';
import { Binds } from 'snowflake-sdk';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AutocompleteCandidate {
    display: string;
    tax_assessor_id: string;
    lat: number;
    lng: number;
}

export type PropertySearchMode = "full" | "contract" | "regrid";

export interface PropertySearchProperty {
    tax_assessor_id: string;
    cherre_parcel_id: string | null;
    address: string;
    city: string;
    state: string;
    zip: string;
    cbsa_code: string | null;
    cbsa_name: string | null;
    county_fips: string | null;
    county_name: string | null;
    lat: number;
    lng: number;
    property_type: string | null;
    year_built: number | null;
    stories: number | null;
    rooms: number | null;
    beds: number | null;
    baths: number | null;
    partial_baths: number | null;
    building_sqft: number | null;
    lot_sqft: number | null;
    avm: number | null;
    avm_confidence: number | null;
    avm_delta_yoy: number | null;
    valuation_date: string | null;
    last_sale_date: string | null;
    last_sale_price: number | null;
    prior_sale_date: string | null;
    prior_sale_price: number | null;
    assessor_publish_date: string | null;
}

export interface PropertySearchRegrid {
    // Owner & Parcel
    owner: string | null;
    owner2: string | null;
    owner_type: string | null;
    mailing_address: string | null;
    apn: string | null;
    regrid_id: string | null;
    record_type: string | null;        // REGRID_OWNTYPE → "Fee Simple" etc.
    owner_occupied: boolean | null;    // REGRID_HOMESTEAD_EXEMPTION != null
    // Legal & Zoning
    legal_description: string | null;
    subdivision: string | null;
    zoning: string | null;
    zoning_description: string | null;
    land_use_code: string | null;
    use_description: string | null;    // REGRID_USEDESC
    use_category: string | null;       // REGRID_LBCS_ACTIVITY_DESC
    std_use: string | null;            // REGRID_LBCS_FUNCTION_DESC
    // Land & Dimensions
    lot_acres: number | null;
    lot_sqft: number | null;
    frontage_ft: number | null;
    depth_ft: number | null;
    lot_shape: string | null;          // REGRID_STRUCT
    gis_acreage: number | null;        // REGRID_LL_GISACRE
    // Tax Assessment
    land_value: number | null;
    improvement_value: number | null;
    total_assessed: number | null;
    market_value: number | null;
    tax_year: number | null;
    annual_tax: number | null;
    // Transaction History (prior sale — last sale is on property)
    prior_sale_date: string | null;
    prior_sale_price: number | null;
    deed_type: string | null;          // REGRID_OWNTYPE used as deed type proxy
    // Census & Geography
    census_tract: string | null;
    block_group: string | null;
    h3_8: string | null;               // placeholder — not in view
    neighborhood: string | null;
    school_district: string | null;
    flood_zone: string | null;
    // Extra
    frontage_ft2: number | null;
    depth_ft2: number | null;
}

export interface NearbyComp {
    address: string;
    tax_assessor_id?: string;
    lat?: number;
    lng?: number;
    property_type: string;
    year_built: number | null;
    sqft: number | null;
    beds: number | null;
    baths: number | null;
    avm: number | null;
    last_sale_date: string | null;
    data_source: string;
}

export interface PropertySearchResult {
    property: PropertySearchProperty;
    regrid: PropertySearchRegrid | null;
    nearby_comps: NearbyComp[];
    regrid_unavailable?: boolean;
    avm_unavailable?: boolean;
}

export interface MarketContextLevel {
    code: string;
    name: string;
    as_of: string;
    sfr?: Record<string, unknown>;
    btr?: Record<string, unknown>;
    mf?: Record<string, unknown>;
    nlp?: Record<string, unknown>;
}

export interface MarketContextResult {
    cbsa: MarketContextLevel | null;
    county: MarketContextLevel | null;
    zip: MarketContextLevel | null;
}

// ─── Internal Snowflake row shapes ─────────────────────────────────────────

interface AutocompleteRow {
    TAX_ASSESSOR_ID: string;
    DISPLAY_ADDRESS: string;
    LATITUDE: number;
    LONGITUDE: number;
}

// Columns present in BOTH V_PROPERTY_WITH_REGRID and V_PROPERTY_FULL (base set)
// plus all REGRID_* columns that exist in V_PROPERTY_WITH_REGRID only.
interface PropertyRow {
    // Base (both views)
    TAX_ASSESSOR_ID: string;
    CHERRE_PARCEL_ID: string | null;
    FIPS_CODE: string | null;
    STATE_FIPS_CODE: string | null;
    STATE: string | null;
    CITY: string | null;
    ZIP: string | null;
    CBSA_CODE: string | null;
    CBSA_NAME: string | null;
    MSA_CODE: string | null;
    MSA_NAME: string | null;
    CENSUS_TRACT_GEOID: string | null;
    TRACT_NAME: string | null;
    CENSUS_TRACT: number | null;
    LATITUDE: number;
    LONGITUDE: number;
    PROPERTY_USE_CODE_MAPPED: number | null;
    PROPERTY_USE_STANDARDIZED_CODE: string | null;
    PROPERTY_GROUP_TYPE: string | null;
    LAST_SALE_DATE: string | null;
    LAST_SALE_AMOUNT: number | null;
    YEAR_BUILT: number | null;
    BUILDING_SQ_FT: number | null;
    ROOM_COUNT: number | null;
    STORIES_COUNT: number | null;
    BED_COUNT: number | null;
    BATH_COUNT: number | null;
    PARTIAL_BATH_COUNT: number | null;
    ESTIMATED_VALUE_AMOUNT: number | null;
    VALUATION_DATE: string | null;
    CONFIDENCE_SCORE: number | null;
    ASSESSOR_PUBLISH_DATE: string | null;
    ASSESSOR_INGEST_AT: string | null;
    DBT_LOADED_AT: string | null;
    // Regrid columns (V_PROPERTY_WITH_REGRID only — null when using V_PROPERTY_FULL)
    REGRID_ADDRESS: string | null;
    REGRID_MAILADD: string | null;
    REGRID_OWNER: string | null;
    REGRID_OWNER2: string | null;
    REGRID_OWNTYPE: string | null;
    REGRID_HOMESTEAD_EXEMPTION: string | null;
    REGRID_PARCELNUMB: string | null;
    REGRID_LL_UUID: string | null;
    REGRID_LEGALDESC: string | null;
    REGRID_SUBDIVISION: string | null;
    REGRID_ZONING: string | null;
    REGRID_ZONING_DESCRIPTION: string | null;
    REGRID_USECODE: string | null;
    REGRID_USEDESC: string | null;
    REGRID_LBCS_ACTIVITY_DESC: string | null;
    REGRID_LBCS_FUNCTION_DESC: string | null;
    REGRID_DEEDED_ACRES: number | null;
    REGRID_SQFT: number | null;
    REGRID_LL_GISACRE: number | null;
    REGRID_LL_GISSQFT: number | null;
    REGRID_LANDVAL: number | null;
    REGRID_IMPROVVAL: number | null;
    REGRID_PARVAL: number | null;
    REGRID_TAXYEAR: number | null;
    REGRID_TAXAMT: number | null;
    REGRID_SALEDATE: string | null;
    REGRID_SALEPRICE: number | null;
    REGRID_CENSUS_BLOCKGROUP: string | null;
    REGRID_NEIGHBORHOOD: string | null;
    REGRID_CENSUS_UNIFIED_SCHOOL_DISTRICT: string | null;
    REGRID_FEMA_FLOOD_ZONE: string | null;
    REGRID_COUNTY: string | null;
    REGRID_STRUCT: string | null;
}

interface CompRow {
    ADDRESS: string;
    PROPERTY_TYPE: string;
    YEAR_BUILT: number | null;
    BUILDING_SQFT: number | null;
    BEDROOMS: number | null;
    BATHROOMS: number | null;
    AVM: number | null;
    LAST_SALE_DATE: string | null;
}

// Key columns from TRANSFORM_PROD.CLEANED.CLEANED_CHERRE_TAX_ASSESSOR_V2
interface CherreRow {
    TAX_ASSESSOR_ID: string | number;
    ADDRESS: string | null;
    MAILING_ADDRESS: string | null;
    MAILING_CITY: string | null;
    MAILING_STATE: string | null;
    MAILING_ZIP: string | null;
    SITUS_COUNTY: string | null;
    CENSUS_TRACT: number | null;
    CENSUS_BLOCK_GROUP: number | null;
    CENSUS_BLOCK: number | null;
    ZONE_CODE: string | null;
    JURISDICTION: string | null;
    SUBDIVISION: string | null;
    LOT_SIZE_ACRE: number | null;
    LOT_SIZE_SQ_FT: number | null;
    LOT_DEPTH_FT: number | null;
    LOT_WIDTH: number | null;
    DESCRIPTION: string | null;             // legal description
    IS_OWNER_OCCUPIED: boolean | null;
    IS_HOMEOWNER_EXEMPTION: boolean | null;
    ASSESSED_TAX_YEAR: number | null;
    ASSESSED_VALUE_TOTAL: number | null;
    ASSESSED_VALUE_LAND: number | null;
    ASSESSED_VALUE_IMPROVEMENTS: number | null;
    MARKET_VALUE_TOTAL: number | null;
    MARKET_VALUE_YEAR: number | null;
    THE_VALUE_LAND: number | null;
    TAX_BILL_AMOUNT: number | null;
    LAST_SALE_DATE: string | null;
    LAST_SALE_AMOUNT: number | null;
    LAST_SALE_DOCUMENT_TYPE: string | null;
    PRIOR_SALE_DATE: string | null;
    PRIOR_SALE_AMOUNT: number | null;
    FL_FEMA_FLOOD_ZONE: string | null;
    FL_COMMUNITY_NAME: string | null;
    DATA_PUBLISH_DATE: string | null;
}


@Injectable()
export class PropertySearchV2Service {

    constructor(
        private readonly mapboxService: MapboxService,
        private readonly parclLabsService: ParclLabsService,
        private readonly snowflakeService: SnowflakeService) { }

    async getAutocomplete(q: string): Promise<AutocompleteCandidate[]> {
        const trimmed = (q ?? "").trim();
        if (trimmed.length < 3) return [];

        // Primary: Mapbox Search API — same pattern as the deals page.
        // `properties.coordinates.latitude/longitude` is the v6 response path (matching deals.controller.ts).
        try {
            const feature = await this.mapboxService.geocode(trimmed);
            if (feature) {
                const lat: number = feature.properties?.coordinates?.latitude ?? 0;
                const lng: number = feature.properties?.coordinates?.longitude ?? 0;
                const display: string =
                    feature.properties?.full_address ??
                    feature.properties?.name ??
                    trimmed;
                console.log(`[propertySearch] Mapbox autocomplete "${trimmed}" → "${display}" (${lat}, ${lng})`);
                return [{ display, tax_assessor_id: "", lat, lng }];
            }
        } catch (err) {
            console.warn("[propertySearch] Mapbox autocomplete failed:", err);
        }

        return [];
    }

    async getPropertySearch(
        q: string,
        mode: PropertySearchMode
    ): Promise<PropertySearchResult | null> {
        const trimmed = (q ?? "").trim();
        if (!trimmed) return null;

        const includeAvm = mode !== "regrid";
        const includeRegrid = mode !== "contract";
        const isTaxId = /^\d+$/.test(trimmed);

        // ── Step 1: Geocode with Mapbox (same as deals page) ───────────────────
        // Always geocode address queries to get precise lat/lng.
        // Uses `properties.coordinates.latitude/longitude` — the v6 path from deals.controller.ts.
        let geocodedLat: number | null = null;
        let geocodedLng: number | null = null;
        let geocodedAddress: string | null = null;
        let geocodedCity: string | null = null;
        let geocodedState: string | null = null;
        let geocodedZip: string | null = null;

        if (!isTaxId) {
            try {
                const feature = await this.mapboxService.geocode(trimmed);
                const featureType = feature?.properties?.feature_type ?? "null";
                console.log(`[propertySearch] Mapbox geocode feature_type="${featureType}" full_address="${feature?.properties?.full_address ?? "n/a"}"`);
                if (feature) {
                    geocodedLat = feature.properties?.coordinates?.latitude ?? null;
                    geocodedLng = feature.properties?.coordinates?.longitude ?? null;
                    const ctx = feature.properties?.context ?? {};
                    geocodedCity = ctx.place?.name ?? null;
                    geocodedState = ctx.region?.region_code ?? null;
                    geocodedZip = ctx.postcode?.name ?? null;

                    if (featureType === "address") {
                        // Exact address match — use Mapbox name (e.g. "4127 Ballantyne Commons Pkwy")
                        geocodedAddress = feature.properties?.name ?? null;
                    } else {
                        // street/poi/place — Mapbox dropped the house number; keep the original user input
                        // so Parcl Labs receives a proper "4127 Street Name" query.
                        geocodedAddress = trimmed;
                    }
                    console.log(`[propertySearch] Mapbox geocoded "${trimmed}" → lat=${geocodedLat} lng=${geocodedLng} city=${geocodedCity} state=${geocodedState} zip=${geocodedZip} (address for Parcl: "${geocodedAddress}")`);
                } else {
                    console.warn(`[propertySearch] Mapbox returned no features for "${trimmed}"`);
                }
            } catch (err) {
                console.warn("[propertySearch] Mapbox geocode failed:", err);
            }
        }

        // ── Step 2: Query Snowflake — try V_PROPERTY_WITH_REGRID first (has all regrid fields),
        //           fall back to V_PROPERTY_FULL if no rows returned (V_PROPERTY_WITH_REGRID only
        //           has data for areas where Regrid has been matched).
        let snowflakeRows: PropertyRow[] = [];
        let usedRegridView = false;
        try {
            let whereClause: string;
            let binds: Binds;

            if (isTaxId) {
                console.log(`[propertySearch] Tax ID: ${trimmed}`);
                whereClause = "p.TAX_ASSESSOR_ID = :1";
                binds = [trimmed];
            } else if (geocodedLat != null && geocodedLng != null) {
                console.log(`[propertySearch] Geocoded lat=${geocodedLat} lng=${geocodedLng}`);
                whereClause = `HAVERSINE(p.LATITUDE, p.LONGITUDE, ${geocodedLat}, ${geocodedLng}) < 0.3`;
                binds = [];
            } else {
                console.log(`[propertySearch] Geocoded lat=${geocodedLat} lng=${geocodedLng}`);
                whereClause = "LOWER(p.CITY || ', ' || p.STATE || ' ' || p.ZIP) LIKE :1";
                binds = [`%${trimmed.toLowerCase()}%`];
            }
            console.log(`[propertySearch] Snowflake WHERE: ${whereClause}`);

            // V_PROPERTY_WITH_REGRID has all 200+ Regrid columns on top of the base set
            const regridSql = `
                SELECT
                    p.TAX_ASSESSOR_ID,
                    p.CHERRE_PARCEL_ID,
                    p.FIPS_CODE,
                    p.STATE_FIPS_CODE,
                    p.STATE,
                    p.CITY,
                    p.ZIP,
                    p.CBSA_CODE,
                    p.CBSA_NAME,
                    p.MSA_CODE,
                    p.MSA_NAME,
                    p.CENSUS_TRACT_GEOID,
                    p.TRACT_NAME,
                    p.CENSUS_TRACT,
                    p.LATITUDE,
                    p.LONGITUDE,
                    p.PROPERTY_USE_CODE_MAPPED,
                    p.PROPERTY_USE_STANDARDIZED_CODE,
                    p.PROPERTY_GROUP_TYPE,
                    p.LAST_SALE_DATE::varchar       AS LAST_SALE_DATE,
                    p.LAST_SALE_AMOUNT,
                    p.YEAR_BUILT,
                    p.BUILDING_SQ_FT,
                    p.ROOM_COUNT,
                    p.STORIES_COUNT,
                    p.BED_COUNT,
                    p.BATH_COUNT,
                    p.PARTIAL_BATH_COUNT,
                    p.ESTIMATED_VALUE_AMOUNT,
                    p.VALUATION_DATE::varchar        AS VALUATION_DATE,
                    p.CONFIDENCE_SCORE,
                    p.ASSESSOR_PUBLISH_DATE::varchar AS ASSESSOR_PUBLISH_DATE,
                    p.ASSESSOR_INGEST_AT::varchar    AS ASSESSOR_INGEST_AT,
                    p.DBT_LOADED_AT::varchar         AS DBT_LOADED_AT,
                    -- Regrid fields
                    p.REGRID_ADDRESS,
                    p.REGRID_MAILADD,
                    p.REGRID_OWNER,
                    p.REGRID_OWNER2,
                    p.REGRID_OWNTYPE,
                    p.REGRID_HOMESTEAD_EXEMPTION,
                    p.REGRID_PARCELNUMB,
                    p.REGRID_LL_UUID,
                    p.REGRID_LEGALDESC,
                    p.REGRID_SUBDIVISION,
                    p.REGRID_ZONING,
                    p.REGRID_ZONING_DESCRIPTION,
                    p.REGRID_USECODE,
                    p.REGRID_USEDESC,
                    p.REGRID_LBCS_ACTIVITY_DESC,
                    p.REGRID_LBCS_FUNCTION_DESC,
                    p.REGRID_DEEDED_ACRES,
                    p.REGRID_SQFT,
                    p.REGRID_LL_GISACRE,
                    p.REGRID_LL_GISSQFT,
                    p.REGRID_LANDVAL,
                    p.REGRID_IMPROVVAL,
                    p.REGRID_PARVAL,
                    p.REGRID_TAXYEAR,
                    p.REGRID_TAXAMT,
                    p.REGRID_SALEDATE::varchar       AS REGRID_SALEDATE,
                    p.REGRID_SALEPRICE,
                    p.REGRID_CENSUS_BLOCKGROUP,
                    p.REGRID_NEIGHBORHOOD,
                    p.REGRID_CENSUS_UNIFIED_SCHOOL_DISTRICT,
                    p.REGRID_FEMA_FLOOD_ZONE,
                    p.REGRID_COUNTY,
                    p.REGRID_STRUCT
                FROM EDW_PROD.DELIVERY.V_PROPERTY_WITH_REGRID p
                WHERE ${whereClause}
                ORDER BY HAVERSINE(p.LATITUDE, p.LONGITUDE, ${geocodedLat ?? 0}, ${geocodedLng ?? 0}) ASC
                LIMIT 1
            `;
            snowflakeRows = await this.snowflakeService.executeQuery<PropertyRow>(regridSql, binds);
            if (snowflakeRows.length > 0) {
                usedRegridView = true;
                console.log(`[propertySearch] V_PROPERTY_WITH_REGRID returned 1 row (full Regrid data)`);
            } else {
                console.log(`[propertySearch] V_PROPERTY_WITH_REGRID returned 0 rows — falling back to V_PROPERTY_FULL`);
            }
        } catch (err) {
            console.warn("[propertySearch] V_PROPERTY_WITH_REGRID query failed:", (err as any)?.message ?? err);
        }

        // Fallback to V_PROPERTY_FULL (base columns only, no Regrid enrichment)
        if (snowflakeRows.length === 0) {
            try {
                let whereClause: string;
                let binds: Binds;
                if (isTaxId) {
                    whereClause = "p.TAX_ASSESSOR_ID = :1";
                    binds = [trimmed];
                } else if (geocodedLat != null && geocodedLng != null) {
                    whereClause = `HAVERSINE(p.LATITUDE, p.LONGITUDE, ${geocodedLat}, ${geocodedLng}) < 0.3`;
                    binds = [];
                } else {
                    whereClause = "LOWER(p.CITY || ', ' || p.STATE || ' ' || p.ZIP) LIKE :1";
                    binds = [`%${trimmed.toLowerCase()}%`];
                }
                const fullSql = `
                    SELECT
                        p.TAX_ASSESSOR_ID,
                        p.CHERRE_PARCEL_ID,
                        p.FIPS_CODE,
                        p.STATE_FIPS_CODE,
                        p.STATE,
                        p.CITY,
                        p.ZIP,
                        p.CBSA_CODE,
                        p.CBSA_NAME,
                        p.MSA_CODE,
                        p.MSA_NAME,
                        p.CENSUS_TRACT_GEOID,
                        p.TRACT_NAME,
                        p.CENSUS_TRACT,
                        p.LATITUDE,
                        p.LONGITUDE,
                        p.PROPERTY_USE_CODE_MAPPED,
                        p.PROPERTY_USE_STANDARDIZED_CODE,
                        p.PROPERTY_GROUP_TYPE,
                        p.LAST_SALE_DATE::varchar       AS LAST_SALE_DATE,
                        p.LAST_SALE_AMOUNT,
                        p.YEAR_BUILT,
                        p.BUILDING_SQ_FT,
                        p.ROOM_COUNT,
                        p.STORIES_COUNT,
                        p.BED_COUNT,
                        p.BATH_COUNT,
                        p.PARTIAL_BATH_COUNT,
                        p.ESTIMATED_VALUE_AMOUNT,
                        p.VALUATION_DATE::varchar        AS VALUATION_DATE,
                        p.CONFIDENCE_SCORE,
                        p.ASSESSOR_PUBLISH_DATE::varchar AS ASSESSOR_PUBLISH_DATE,
                        p.ASSESSOR_INGEST_AT::varchar    AS ASSESSOR_INGEST_AT,
                        p.DBT_LOADED_AT::varchar         AS DBT_LOADED_AT,
                        -- Regrid columns not present in V_PROPERTY_FULL — return nulls
                        NULL AS REGRID_ADDRESS,
                        NULL AS REGRID_MAILADD,
                        NULL AS REGRID_OWNER,
                        NULL AS REGRID_OWNER2,
                        NULL AS REGRID_OWNTYPE,
                        NULL AS REGRID_HOMESTEAD_EXEMPTION,
                        NULL AS REGRID_PARCELNUMB,
                        NULL AS REGRID_LL_UUID,
                        NULL AS REGRID_LEGALDESC,
                        NULL AS REGRID_SUBDIVISION,
                        NULL AS REGRID_ZONING,
                        NULL AS REGRID_ZONING_DESCRIPTION,
                        NULL AS REGRID_USECODE,
                        NULL AS REGRID_USEDESC,
                        NULL AS REGRID_LBCS_ACTIVITY_DESC,
                        NULL AS REGRID_LBCS_FUNCTION_DESC,
                        NULL AS REGRID_DEEDED_ACRES,
                        NULL AS REGRID_SQFT,
                        NULL AS REGRID_LL_GISACRE,
                        NULL AS REGRID_LL_GISSQFT,
                        NULL AS REGRID_LANDVAL,
                        NULL AS REGRID_IMPROVVAL,
                        NULL AS REGRID_PARVAL,
                        NULL AS REGRID_TAXYEAR,
                        NULL AS REGRID_TAXAMT,
                        NULL AS REGRID_SALEDATE,
                        NULL AS REGRID_SALEPRICE,
                        NULL AS REGRID_CENSUS_BLOCKGROUP,
                        NULL AS REGRID_NEIGHBORHOOD,
                        NULL AS REGRID_CENSUS_UNIFIED_SCHOOL_DISTRICT,
                        NULL AS REGRID_FEMA_FLOOD_ZONE,
                        NULL AS REGRID_COUNTY,
                        NULL AS REGRID_STRUCT
                    FROM EDW_PROD.DELIVERY.V_PROPERTY_FULL p
                    WHERE ${whereClause}
                    ORDER BY HAVERSINE(p.LATITUDE, p.LONGITUDE, ${geocodedLat ?? 0}, ${geocodedLng ?? 0}) ASC
                    LIMIT 1
                `;
                snowflakeRows = await this.snowflakeService.executeQuery<PropertyRow>(fullSql, binds);
                console.log(`[propertySearch] V_PROPERTY_FULL returned ${snowflakeRows.length} row(s)`);
            } catch (err) {
                console.warn("[propertySearch] V_PROPERTY_FULL query failed — will try Parcl fallback:", (err as any)?.message ?? err);
            }
        }

        // ── Step 3: If Snowflake returned a row, build and return the full result ─
        if (snowflakeRows.length > 0) {
            const r = snowflakeRows[0];
            const hasRegrid = usedRegridView && r.REGRID_LL_UUID != null;

            // ── Step 3a: Enrich with CLEANED_CHERRE_TAX_ASSESSOR_V2 (owner, tax, legal, census) ──
            // This table has full address, owner info, tax assessment, lot, flood zone, etc.
            // It is always available since V_PROPERTY_WITH_REGRID may be empty.
            let cherre: CherreRow | null = null;
            try {
                const cherreRows = await this.snowflakeService.executeQuery<CherreRow>(
                    `SELECT
                        TAX_ASSESSOR_ID,
                        ADDRESS,
                        MAILING_ADDRESS,
                        MAILING_CITY,
                        MAILING_STATE,
                        MAILING_ZIP,
                        SITUS_COUNTY,
                        CENSUS_TRACT,
                        CENSUS_BLOCK_GROUP,
                        CENSUS_BLOCK,
                        ZONE_CODE,
                        JURISDICTION,
                        SUBDIVISION,
                        LOT_SIZE_ACRE,
                        LOT_SIZE_SQ_FT,
                        LOT_DEPTH_FT,
                        LOT_WIDTH,
                        DESCRIPTION,
                        IS_OWNER_OCCUPIED,
                        IS_HOMEOWNER_EXEMPTION,
                        ASSESSED_TAX_YEAR,
                        ASSESSED_VALUE_TOTAL,
                        ASSESSED_VALUE_LAND,
                        ASSESSED_VALUE_IMPROVEMENTS,
                        MARKET_VALUE_TOTAL,
                        MARKET_VALUE_YEAR,
                        THE_VALUE_LAND,
                        TAX_BILL_AMOUNT,
                        LAST_SALE_DATE::varchar AS LAST_SALE_DATE,
                        LAST_SALE_AMOUNT,
                        LAST_SALE_DOCUMENT_TYPE,
                        PRIOR_SALE_DATE::varchar AS PRIOR_SALE_DATE,
                        PRIOR_SALE_AMOUNT,
                        FL_FEMA_FLOOD_ZONE,
                        FL_COMMUNITY_NAME,
                        DATA_PUBLISH_DATE::varchar AS DATA_PUBLISH_DATE
                    FROM TRANSFORM_PROD.CLEANED.CLEANED_CHERRE_TAX_ASSESSOR_V2
                    WHERE TAX_ASSESSOR_ID = :1
                      AND CHERRE_IS_DELETED = FALSE
                    LIMIT 1`,
                    [String(r.TAX_ASSESSOR_ID)] as Binds
                );
                cherre = cherreRows[0] ?? null;
                if (cherre) {
                    console.log(`[propertySearch] Cherre enrichment found for TAX_ASSESSOR_ID=${r.TAX_ASSESSOR_ID}`);
                } else {
                    console.log(`[propertySearch] No Cherre row for TAX_ASSESSOR_ID=${r.TAX_ASSESSOR_ID} — enrichment skipped`);
                }
            } catch (err) {
                console.warn("[propertySearch] Cherre enrichment query failed:", (err as any)?.message ?? err);
            }

            const property: PropertySearchProperty = {
                tax_assessor_id: String(r.TAX_ASSESSOR_ID),
                cherre_parcel_id: r.CHERRE_PARCEL_ID,
                // Prefer: (1) Cherre street address, (2) Regrid address, (3) Mapbox geocoded
                address: cherre?.ADDRESS ?? r.REGRID_ADDRESS ?? geocodedAddress ?? trimmed,
                city: r.CITY ?? geocodedCity ?? "",
                state: r.STATE ?? geocodedState ?? "",
                zip: r.ZIP ?? geocodedZip ?? "",
                cbsa_code: r.CBSA_CODE,
                cbsa_name: r.CBSA_NAME,
                county_fips: r.FIPS_CODE,
                county_name: cherre?.SITUS_COUNTY ?? r.REGRID_COUNTY ?? null,
                lat: r.LATITUDE,
                lng: r.LONGITUDE,
                property_type: r.PROPERTY_GROUP_TYPE,
                year_built: r.YEAR_BUILT,
                stories: r.STORIES_COUNT,
                rooms: r.ROOM_COUNT,
                beds: r.BED_COUNT,
                baths: r.BATH_COUNT,
                partial_baths: r.PARTIAL_BATH_COUNT,
                building_sqft: r.BUILDING_SQ_FT,
                lot_sqft: cherre?.LOT_SIZE_SQ_FT ?? r.REGRID_SQFT ?? r.REGRID_LL_GISSQFT ?? null,
                avm: r.ESTIMATED_VALUE_AMOUNT,
                avm_confidence: r.CONFIDENCE_SCORE,
                avm_delta_yoy: null,
                valuation_date: r.VALUATION_DATE,
                last_sale_date: cherre?.LAST_SALE_DATE ?? r.LAST_SALE_DATE,
                last_sale_price: cherre?.LAST_SALE_AMOUNT ?? r.LAST_SALE_AMOUNT,
                prior_sale_date: cherre?.PRIOR_SALE_DATE ?? r.REGRID_SALEDATE ?? null,
                prior_sale_price: cherre?.PRIOR_SALE_AMOUNT ?? r.REGRID_SALEPRICE ?? null,
                assessor_publish_date: cherre?.DATA_PUBLISH_DATE ?? r.ASSESSOR_PUBLISH_DATE,
            };

            // Parcl AVM fallback if Snowflake AVM is null and mode requires it
            let avm_unavailable = false;
            if (includeAvm && property.avm == null) {
                try {
                    const parclComps = await this.parclLabsService.getParclComps(
                        property.beds ?? 3,
                        property.baths ?? 2,
                        property.lng,
                        property.lat,
                        property.building_sqft ?? 1500
                    );
                    if (parclComps && parclComps.length > 0) {
                        property.avm = (parclComps[0] as any)?.property_metadata?.avm_value ?? null;
                    }
                } catch (err) {
                    console.warn("[propertySearch] Parcl AVM fallback failed:", err);
                }
                if (property.avm == null) avm_unavailable = true;
            }

            // Build enriched regrid block:
            // Priority: (1) V_PROPERTY_WITH_REGRID (if populated), (2) CLEANED_CHERRE_TAX_ASSESSOR_V2
            const regrid: PropertySearchRegrid | null = (hasRegrid || cherre) ? {
                // Owner & Parcel
                owner: r.REGRID_OWNER ?? null,
                owner2: r.REGRID_OWNER2 ?? null,
                owner_type: r.REGRID_OWNTYPE ?? null,
                mailing_address: r.REGRID_MAILADD ?? (cherre
                    ? [cherre.MAILING_ADDRESS, cherre.MAILING_CITY, cherre.MAILING_STATE, cherre.MAILING_ZIP].filter(Boolean).join(', ')
                    : null),
                apn: r.REGRID_PARCELNUMB ?? null,
                regrid_id: r.REGRID_LL_UUID ?? null,
                record_type: r.REGRID_OWNTYPE ?? null,
                owner_occupied: r.REGRID_HOMESTEAD_EXEMPTION != null && r.REGRID_HOMESTEAD_EXEMPTION !== ""
                    ? true
                    : cherre?.IS_OWNER_OCCUPIED ?? (cherre?.IS_HOMEOWNER_EXEMPTION === true ? true : null),
                // Legal & Zoning
                legal_description: r.REGRID_LEGALDESC ?? cherre?.DESCRIPTION ?? null,
                subdivision: r.REGRID_SUBDIVISION ?? cherre?.SUBDIVISION ?? null,
                zoning: r.REGRID_ZONING ?? cherre?.ZONE_CODE ?? null,
                zoning_description: r.REGRID_ZONING_DESCRIPTION ?? null,
                land_use_code: r.REGRID_USECODE ?? null,
                use_description: r.REGRID_USEDESC ?? null,
                use_category: r.REGRID_LBCS_ACTIVITY_DESC ?? null,
                std_use: r.REGRID_LBCS_FUNCTION_DESC ?? null,
                // Land & Dimensions
                lot_acres: r.REGRID_DEEDED_ACRES ?? cherre?.LOT_SIZE_ACRE ?? null,
                lot_sqft: r.REGRID_SQFT ?? r.REGRID_LL_GISSQFT ?? cherre?.LOT_SIZE_SQ_FT ?? null,
                frontage_ft: r.REGRID_PARCELNUMB != null ? null : null, // Regrid-only
                depth_ft: cherre?.LOT_DEPTH_FT ?? null,
                lot_shape: r.REGRID_STRUCT ?? null,
                gis_acreage: r.REGRID_LL_GISACRE ?? null,
                // Tax Assessment
                land_value: r.REGRID_LANDVAL ?? cherre?.ASSESSED_VALUE_LAND ?? cherre?.THE_VALUE_LAND ?? null,
                improvement_value: r.REGRID_IMPROVVAL ?? cherre?.ASSESSED_VALUE_IMPROVEMENTS ?? null,
                total_assessed: r.REGRID_PARVAL ?? cherre?.ASSESSED_VALUE_TOTAL ?? null,
                market_value: r.REGRID_PARVAL ?? cherre?.MARKET_VALUE_TOTAL ?? null,
                tax_year: r.REGRID_TAXYEAR ?? cherre?.ASSESSED_TAX_YEAR ?? null,
                annual_tax: r.REGRID_TAXAMT ?? cherre?.TAX_BILL_AMOUNT ?? null,
                // Transaction History
                prior_sale_date: r.REGRID_SALEDATE ?? cherre?.PRIOR_SALE_DATE ?? null,
                prior_sale_price: r.REGRID_SALEPRICE ?? cherre?.PRIOR_SALE_AMOUNT ?? null,
                deed_type: cherre?.LAST_SALE_DOCUMENT_TYPE ?? null,
                // Census & Geography
                census_tract: r.CENSUS_TRACT_GEOID ?? (cherre?.CENSUS_TRACT != null ? String(cherre.CENSUS_TRACT) : null),
                block_group: r.REGRID_CENSUS_BLOCKGROUP ?? (cherre?.CENSUS_BLOCK_GROUP != null ? String(cherre.CENSUS_BLOCK_GROUP) : null),
                h3_8: null,
                neighborhood: r.REGRID_NEIGHBORHOOD ?? null,
                school_district: r.REGRID_CENSUS_UNIFIED_SCHOOL_DISTRICT ?? null,
                flood_zone: r.REGRID_FEMA_FLOOD_ZONE ?? cherre?.FL_FEMA_FLOOD_ZONE ?? null,
                frontage_ft2: null,
                depth_ft2: null,
            } : null;

            let nearby_comps: NearbyComp[] = [];
            try {
                // Get base comp list from V_PROPERTY_FULL, then enrich addresses from Cherre
                const compView = usedRegridView
                    ? "EDW_PROD.DELIVERY.V_PROPERTY_WITH_REGRID"
                    : "EDW_PROD.DELIVERY.V_PROPERTY_FULL";
                const addrExpr = usedRegridView ? "p.REGRID_ADDRESS" : "c.ADDRESS";
                const compSql = `
                    SELECT
                        p.TAX_ASSESSOR_ID,
                        ${addrExpr}                     AS COMP_ADDRESS,
                        p.CITY,
                        p.STATE,
                        p.ZIP,
                        p.LATITUDE,
                        p.LONGITUDE,
                        p.PROPERTY_GROUP_TYPE,
                        p.YEAR_BUILT,
                        p.BUILDING_SQ_FT,
                        p.BED_COUNT,
                        p.BATH_COUNT,
                        p.ESTIMATED_VALUE_AMOUNT,
                        p.LAST_SALE_DATE::varchar       AS LAST_SALE_DATE,
                        HAVERSINE(p.LATITUDE, p.LONGITUDE, :4, :5) AS DIST_MI
                    FROM ${compView} p
                    ${!usedRegridView ? `LEFT JOIN TRANSFORM_PROD.CLEANED.CLEANED_CHERRE_TAX_ASSESSOR_V2 c
                        ON c.TAX_ASSESSOR_ID = p.TAX_ASSESSOR_ID AND c.CHERRE_IS_DELETED = FALSE` : ''}
                    WHERE p.ZIP = :1
                      AND p.PROPERTY_GROUP_TYPE = :2
                      AND p.TAX_ASSESSOR_ID != :3
                    ORDER BY DIST_MI ASC
                    LIMIT 5
                `;
                const compRows = await this.snowflakeService.executeQuery<Record<string, any>>(compSql, [
                    r.ZIP,
                    r.PROPERTY_GROUP_TYPE ?? "RESIDENTIAL",
                    r.TAX_ASSESSOR_ID,
                    r.LATITUDE,
                    r.LONGITUDE,
                ] as Binds);
                nearby_comps = compRows.map((c) => ({
                    address: (c.COMP_ADDRESS
                        ?? `${c.CITY ?? ''}${c.STATE ? ', ' + c.STATE : ''}${c.ZIP ? ' ' + c.ZIP : ''}`.trim())
                        || `${Number(c.LATITUDE ?? 0).toFixed(4)}, ${Number(c.LONGITUDE ?? 0).toFixed(4)}`,
                    tax_assessor_id: String(c.TAX_ASSESSOR_ID),
                    lat: c.LATITUDE,
                    lng: c.LONGITUDE,
                    property_type: c.PROPERTY_GROUP_TYPE,
                    year_built: c.YEAR_BUILT,
                    sqft: c.BUILDING_SQ_FT,
                    beds: c.BED_COUNT,
                    baths: c.BATH_COUNT,
                    avm: c.ESTIMATED_VALUE_AMOUNT,
                    last_sale_date: c.LAST_SALE_DATE,
                    data_source: "Assessor",
                }));
            } catch (err) {
                console.warn("[propertySearch] Nearby comps query failed:", err);
            }

            return {
                property,
                regrid,
                nearby_comps,
                ...(avm_unavailable ? { avm_unavailable: true } : {}),
                ...(regrid == null ? { regrid_unavailable: true } : {}),
            };
        }

        // ── Step 4: Snowflake unavailable — build a best-effort result from Mapbox + Parcl ──
        // Parcl fallback: used when Snowflake returns 0 rows or errors out.
        if (!isTaxId && geocodedLat != null && geocodedLng != null) {
            console.log("[propertySearch] Snowflake unavailable — building result from Mapbox + Parcl Labs");

            // Reverse-geocode to get structured address fields if not already parsed from feature context
            if (!geocodedCity || !geocodedState || !geocodedZip) {
                try {
                    const rev = await this.mapboxService.reverseGeocode(String(geocodedLat), String(geocodedLng));
                    if (rev) {
                        geocodedAddress = geocodedAddress ?? rev.address;
                        geocodedCity = geocodedCity ?? rev.city;
                        geocodedState = geocodedState ?? rev.state;
                        geocodedZip = geocodedZip ?? rev.zip;
                    }
                } catch (err) {
                    console.warn("[propertySearch] Mapbox reverse geocode failed:", err);
                }
            }

            // Try Parcl Labs to get property details (beds, baths, sqft, year built, AVM)
            let parclProp: any = null;
            if (geocodedCity && geocodedState && geocodedZip) {
                // Extract just the street portion (everything before the first comma) so Parcl
                // gets "4127 Ballantyne Commons Pkwy" rather than the full user input string.
                const streetOnly = (geocodedAddress ?? trimmed).split(",")[0].trim();
                console.log(`[propertySearch] Parcl lookup: street="${streetOnly}" city="${geocodedCity}" state="${geocodedState}" zip="${geocodedZip}"`);
                try {
                    parclProp = await this.parclLabsService.getPropertyByAddress(
                        streetOnly,
                        geocodedCity,
                        geocodedState,
                        geocodedZip
                    );
                    console.log(`[propertySearch] Parcl found property: ${parclProp ? "yes — id=" + parclProp.parcl_property_id : "no"}`);
                } catch (err) {
                    console.warn("[propertySearch] Parcl property lookup failed:", err);
                }
            } else {
                console.warn(`[propertySearch] Skipping Parcl — missing city/state/zip (city="${geocodedCity}" state="${geocodedState}" zip="${geocodedZip}")`);
            }

            // Build the display address: prefer Parcl's clean address, then the street-only portion of the input
            const displayAddress = parclProp?.address
                ?? (geocodedAddress ?? trimmed).split(",")[0].trim();

            // Fetch AVM via Parcl comps using geocoded coordinates
            let avmValue: number | null = null;
            if (geocodedLat != null && geocodedLng != null) {
                try {
                    const parclComps = await this.parclLabsService.getParclComps(
                        parclProp?.bedrooms ?? 3,
                        parclProp?.bathrooms ?? 2,
                        geocodedLng,
                        geocodedLat,
                        parclProp?.square_footage ?? 1500
                    );
                    avmValue = (parclComps?.[0] as any)?.property_metadata?.avm_value ?? null;
                    console.log(`[propertySearch] Parcl AVM: ${avmValue}`);
                } catch (err) {
                    console.warn("[propertySearch] Parcl AVM comps failed:", err);
                }
            }

            const property: PropertySearchProperty = {
                tax_assessor_id: parclProp ? String(parclProp.parcl_property_id) : "",
                cherre_parcel_id: null,
                address: displayAddress,
                city: geocodedCity ?? "",
                state: geocodedState ?? "",
                zip: geocodedZip ?? "",
                cbsa_code: parclProp?.cbsa ?? null,
                cbsa_name: null,
                county_fips: null,
                county_name: null,
                lat: geocodedLat,
                lng: geocodedLng,
                property_type: parclProp?.property_type ?? null,
                year_built: parclProp?.year_built ?? null,
                stories: null,
                rooms: null,
                beds: parclProp?.bedrooms ?? null,
                baths: parclProp?.bathrooms ?? null,
                partial_baths: null,
                building_sqft: parclProp?.square_footage ?? null,
                lot_sqft: null,
                avm: avmValue,
                avm_confidence: null,
                avm_delta_yoy: null,
                valuation_date: null,
                last_sale_date: null,
                last_sale_price: null,
                prior_sale_date: null,
                prior_sale_price: null,
                assessor_publish_date: null,
            };

            return {
                property,
                regrid: null,
                nearby_comps: [],
                avm_unavailable: true,
                regrid_unavailable: true,
            };
        }

        return null;
    }

    async getMarketContext(
        tax_assessor_id: string
    ): Promise<MarketContextResult | null> {
        if (!(tax_assessor_id ?? "").trim()) return null;

        // Resolve geography codes for this property
        let cbsaCode: string | null = null;
        let cbsaName: string | null = null;
        let countyFips: string | null = null;
        let zipCode: string | null = null;

        try {
            const geoRows = await this.snowflakeService.executeQuery<{
                CBSA_CODE: string | null;
                CBSA_NAME: string | null;
                FIPS_CODE: string | null;
                ZIP: string | null;
            }>(
                `SELECT CBSA_CODE, CBSA_NAME, FIPS_CODE, ZIP
                 FROM EDW_PROD.DELIVERY.V_PROPERTY_FULL
                 WHERE TAX_ASSESSOR_ID = :1
                 LIMIT 1`,
                [tax_assessor_id] as Binds
            );
            if (!geoRows.length) return { cbsa: null, county: null, zip: null };
            cbsaCode = geoRows[0].CBSA_CODE;
            cbsaName = geoRows[0].CBSA_NAME;
            countyFips = geoRows[0].FIPS_CODE;
            zipCode = geoRows[0].ZIP;
        } catch (err) {
            console.warn("[marketContext] Geography resolution failed:", err);
            return { cbsa: null, county: null, zip: null };
        }

        // Fetch Redfin SFR metrics for each geo level in parallel
        const [cbsaSfr, zipSfr] = await Promise.all([
            cbsaCode ? this.queryRedfinMetrics("TRANSFORM_PROD.FACT.FACT_REDFIN_SFR_CBSA", cbsaCode) : Promise.resolve(undefined),
            zipCode ? this.queryRedfinMetrics("TRANSFORM_PROD.FACT.FACT_REDFIN_SFR_ZIP", zipCode) : Promise.resolve(undefined),
        ]);

        const asOf = (cbsaSfr?.AS_OF ?? zipSfr?.AS_OF ?? "") as string;

        const makeLevel = (
            code: string | null,
            name: string | null,
            sfr: Record<string, unknown> | undefined
        ): MarketContextLevel | null => {
            if (!code) return null;
            return {
                code,
                name: name ?? code,
                as_of: asOf,
                ...(sfr ? { sfr } : {}),
            };
        };

        return {
            cbsa: makeLevel(cbsaCode, cbsaName, cbsaSfr),
            county: makeLevel(countyFips, countyFips, undefined),  // county-level Redfin table not authorized
            zip: makeLevel(zipCode, zipCode, zipSfr),
        };
    }

    async queryRedfinMetrics(
        table: string,
        geoId: string
    ): Promise<Record<string, unknown> | undefined> {
        if (!geoId) return undefined;
        try {
            // Pivot the desired metrics into columns using conditional aggregation.
            // We filter to PRODUCT_TYPE_CODE IN ('SFR','ALL') and take the most-recent month.
            const rows = await this.snowflakeService.executeQuery<Record<string, unknown>>(
                `SELECT
                    MAX(DATE_REFERENCE)::varchar                                               AS AS_OF,
                    MAX(CASE WHEN METRIC_ID = 'REDFIN_MEDIAN_SALE_PRICE'  THEN VALUE END)     AS MEDIAN_SALE_PRICE,
                    MAX(CASE WHEN METRIC_ID = 'REDFIN_MEDIAN_PPSF'        THEN VALUE END)     AS MEDIAN_PPSF,
                    MAX(CASE WHEN METRIC_ID = 'REDFIN_INVENTORY'          THEN VALUE END)     AS ACTIVE_LISTINGS,
                    MAX(CASE WHEN METRIC_ID = 'REDFIN_MEDIAN_DOM'         THEN VALUE END)     AS MEDIAN_DOM,
                    MAX(CASE WHEN METRIC_ID = 'REDFIN_HOMES_SOLD'         THEN VALUE END)     AS HOMES_SOLD,
                    MAX(CASE WHEN METRIC_ID = 'REDFIN_NEW_LISTINGS'       THEN VALUE END)     AS NEW_LISTINGS,
                    MAX(CASE WHEN METRIC_ID = 'REDFIN_MONTHS_OF_SUPPLY'   THEN VALUE END)     AS MONTHS_OF_SUPPLY,
                    MAX(CASE WHEN METRIC_ID = 'REDFIN_AVG_SALE_TO_LIST'   THEN VALUE END)     AS AVG_SALE_TO_LIST,
                    MAX(CASE WHEN METRIC_ID = 'REDFIN_SOLD_ABOVE_LIST'    THEN VALUE END)     AS SOLD_ABOVE_LIST,
                    MAX(CASE WHEN METRIC_ID = 'REDFIN_PRICE_DROPS'        THEN VALUE END)     AS PRICE_DROPS,
                    MAX(CASE WHEN METRIC_ID = 'REDFIN_MEDIAN_SALE_PRICE_YOY' THEN VALUE END)  AS MEDIAN_SALE_PRICE_YOY,
                    MAX(CASE WHEN METRIC_ID = 'REDFIN_MEDIAN_PPSF_YOY'   THEN VALUE END)     AS MEDIAN_PPSF_YOY,
                    MAX(CASE WHEN METRIC_ID = 'REDFIN_INVENTORY_YOY'      THEN VALUE END)     AS ACTIVE_LISTINGS_YOY,
                    MAX(CASE WHEN METRIC_ID = 'REDFIN_MEDIAN_DOM_YOY'     THEN VALUE END)     AS MEDIAN_DOM_YOY
                 FROM ${table}
                 WHERE GEO_ID = :1
                   AND PRODUCT_TYPE_CODE IN ('SFR', 'ALL')
                   AND DATE_REFERENCE = (
                       SELECT MAX(DATE_REFERENCE) FROM ${table}
                       WHERE GEO_ID = :2 AND PRODUCT_TYPE_CODE IN ('SFR', 'ALL')
                   )`,
                [geoId, geoId] as Binds
            );
            const row = rows[0];
            // If everything is null there's no data for this geo
            if (!row || Object.values(row).every(v => v == null)) return undefined;
            return row;
        } catch (err) {
            console.warn(`[marketContext] Redfin query failed for ${table} GEO_ID=${geoId}:`, (err as any)?.message ?? err);
            return undefined;
        }
    }
}