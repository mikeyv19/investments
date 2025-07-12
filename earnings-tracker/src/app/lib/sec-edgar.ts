/**
 * SEC EDGAR API Client
 *
 * Requirements:
 * - User-Agent header with contact info
 * - Rate limit: 10 requests/second max
 * - No authentication required
 */

import { SECCompanyInfo, SECFiling, HistoricalEPS } from "@/app/types";

const SEC_API_BASE = "https://data.sec.gov";
const SEC_ARCHIVES_BASE = "https://www.sec.gov/Archives";

// IMPORTANT: Update this with your contact information
const USER_AGENT = "mattmass123@gmail.com";

// Rate limiting: max 10 requests per second
const RATE_LIMIT_MS = 100; // 100ms between requests = 10 req/sec max
let lastRequestTime = 0;

async function rateLimitedFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest)
    );
  }

  lastRequestTime = Date.now();

  return fetch(url, {
    ...options,
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      ...options?.headers,
    },
  });
}

/**
 * Search for company by ticker symbol
 */
export async function searchCompanyByTicker(
  ticker: string
): Promise<SECCompanyInfo | null> {
  try {
    const response = await rateLimitedFetch(
      `${SEC_API_BASE}/submissions/CIK${ticker.padStart(10, "0")}.json`
    );

    if (!response.ok) {
      // Try alternate endpoint
      const tickerResponse = await rateLimitedFetch(
        `${SEC_API_BASE}/api/xbrl/companyfacts/CIK${ticker}.json`
      );

      if (!tickerResponse.ok) {
        return null;
      }
    }

    const data = await response.json();

    return {
      cik: data.cik,
      ticker: data.tickers?.[0] || ticker,
      name: data.name,
      sic: data.sic,
      sicDescription: data.sicDescription,
      exchanges: data.exchanges || [],
    };
  } catch (error) {
    console.error("Error searching company by ticker:", error);
    return null;
  }
}

/**
 * Get company tickers mapping (for bulk lookups)
 */
export async function getCompanyTickers(): Promise<Map<string, string>> {
  try {
    const response = await rateLimitedFetch(
      "https://www.sec.gov/files/company_tickers.json"
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch company tickers: ${response.status}`);
    }

    const data = await response.json();
    const tickerMap = new Map<string, string>();

    // Convert response to ticker -> CIK mapping
    Object.values(data).forEach((company: any) => {
      if (company.ticker) {
        tickerMap.set(company.ticker, company.cik_str.padStart(10, "0"));
      }
    });

    return tickerMap;
  } catch (error) {
    console.error("Error fetching company tickers:", error);
    return new Map();
  }
}

/**
 * Get recent filings for a company
 */
export async function getCompanyFilings(
  cik: string,
  formTypes: string[] = ["10-Q", "10-K", "8-K"]
): Promise<SECFiling[]> {
  try {
    const paddedCik = cik.padStart(10, "0");
    const response = await rateLimitedFetch(
      `${SEC_API_BASE}/submissions/CIK${paddedCik}.json`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch filings: ${response.status}`);
    }

    const data = await response.json();
    const recentFilings = data.filings.recent;

    const filings: SECFiling[] = [];

    for (let i = 0; i < recentFilings.form.length; i++) {
      if (formTypes.includes(recentFilings.form[i])) {
        filings.push({
          accessionNumber: recentFilings.accessionNumber[i],
          filingDate: recentFilings.filingDate[i],
          reportDate: recentFilings.reportDate[i],
          form: recentFilings.form[i],
          primaryDocument: recentFilings.primaryDocument[i],
          items: recentFilings.items?.[i] || [],
        });
      }
    }

    return filings.sort(
      (a, b) =>
        new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime()
    );
  } catch (error) {
    console.error("Error fetching company filings:", error);
    return [];
  }
}

/**
 * Extract EPS data from company facts
 */
export async function getHistoricalEPS(
  cik: string,
  ticker: string
): Promise<HistoricalEPS[]> {
  try {
    const paddedCik = cik.padStart(10, "0");
    const response = await rateLimitedFetch(
      `${SEC_API_BASE}/api/xbrl/companyfacts/CIK${paddedCik}.json`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch company facts: ${response.status}`);
    }

    const data = await response.json();
    const epsData: HistoricalEPS[] = [];

    // Look for EPS data in different possible locations
    const epsConcepts = [
      "us-gaap:EarningsPerShareDiluted",
      "us-gaap:EarningsPerShareBasic",
      "us-gaap:EarningsPerShare",
    ];

    for (const concept of epsConcepts) {
      const conceptData = data.facts?.["us-gaap"]?.[concept.split(":")[1]];

      if (conceptData?.units?.["USD/shares"]) {
        const epsValues = conceptData.units["USD/shares"];

        for (const entry of epsValues) {
          // Only include quarterly data (10-Q) and annual data (10-K)
          if (entry.form === "10-Q" || entry.form === "10-K") {
            const quarter = getQuarterFromPeriod(entry.fp, entry.fy);

            epsData.push({
              id: "", // Will be generated by database
              company_id: "", // Will be set when saving
              fiscal_period: quarter,
              eps_actual: entry.val,
              filing_date: entry.filed,
              created_at: new Date().toISOString(),
            });
          }
        }

        break; // Use first available EPS concept
      }
    }

    // Remove duplicates and sort by filing date
    const uniqueEps = Array.from(
      new Map(epsData.map((item) => [`${item.fiscal_period}`, item])).values()
    ).sort(
      (a, b) =>
        new Date(b.filing_date).getTime() - new Date(a.filing_date).getTime()
    );

    return uniqueEps;
  } catch (error) {
    console.error("Error fetching historical EPS:", error);
    return [];
  }
}

/**
 * Helper function to convert SEC period notation to standard quarter format
 */
function getQuarterFromPeriod(fp: string, fy: number): string {
  const quarterMap: Record<string, string> = {
    Q1: "Q1",
    Q2: "Q2",
    Q3: "Q3",
    Q4: "Q4",
    FY: "FY", // Full year
  };

  return `${quarterMap[fp] || fp} ${fy}`;
}

/**
 * Bulk fetch EPS data for multiple companies
 */
export async function bulkFetchHistoricalEPS(
  companies: Array<{ ticker: string; cik?: string }>
): Promise<Map<string, HistoricalEPS[]>> {
  const epsMap = new Map<string, HistoricalEPS[]>();

  // Get ticker to CIK mapping if needed
  const tickerToCik = await getCompanyTickers();

  for (const company of companies) {
    const cik = company.cik || tickerToCik.get(company.ticker.toUpperCase());

    if (cik) {
      const epsData = await getHistoricalEPS(cik, company.ticker);
      if (epsData.length > 0) {
        epsMap.set(company.ticker, epsData);
      }
    }

    // Add delay between companies to respect rate limit
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
  }

  return epsMap;
}

/**
 * Validate CIK format
 */
export function isValidCIK(cik: string): boolean {
  return /^\d{1,10}$/.test(cik);
}

/**
 * Format CIK to standard 10-digit format
 */
export function formatCIK(cik: string): string {
  return cik.padStart(10, "0");
}
