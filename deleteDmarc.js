require("dotenv").config()
const axios = require("axios")

const apiBaseURL = "https://api.cloudflare.com/client/v4"
const cloudflareApiToken = process.env.cloudflareApiToken
const spfRecord = process.env.SPF_RECORD
const dmarcRecord = process.env.DMARC_RECORD
const skipDomains = process.env.SKIP_DOMAINS
  ? process.env.SKIP_DOMAINS.split(",")
  : []

const getAllZones = async () => {
  let allZones = []
  let page = 1
  let totalPages

  try {
    do {
      console.log(`Fetching zones, page: ${page}`)
      const response = await axios.get(`${apiBaseURL}/zones`, {
        headers: {
          Authorization: `Bearer ${cloudflareApiToken}`,
          "Content-Type": "application/json",
        },
        params: {
          page: page,
          per_page: 50,
        },
      })

      allZones = allZones.concat(response.data.result)
      totalPages = response.data.result_info.total_pages
      page++
    } while (page <= totalPages)

    console.log(`Total zones fetched: ${allZones.length}`)
    return allZones
  } catch (error) {
    console.error(
      `Failed to list domains: ${
        error.response
          ? JSON.stringify(error.response.data, null, 2)
          : error.message
      }`
    )
    throw error
  }
}

const listDNSRecords = async (zoneId) => {
  try {
    console.log(`Listing DNS records for zone: ${zoneId}`)
    const response = await axios.get(
      `${apiBaseURL}/zones/${zoneId}/dns_records`,
      {
        headers: {
          Authorization: `Bearer ${cloudflareApiToken}`,
          "Content-Type": "application/json",
        },
        params: { type: "TXT" },
      }
    )
    return response.data.result
  } catch (error) {
    console.error(
      `Failed to list DNS records for zone ${zoneId}: ${
        error.response
          ? JSON.stringify(error.response.data, null, 2)
          : error.message
      }`
    )
    throw error
  }
}

const deleteDNSRecord = async (zoneId, recordId, domainName) => {
  try {
    console.log(`Deleting DNS record ${recordId} for domain ${domainName}`)
    await axios.delete(
      `${apiBaseURL}/zones/${zoneId}/dns_records/${recordId}`,
      {
        headers: {
          Authorization: `Bearer ${cloudflareApiToken}`,
          "Content-Type": "application/json",
        },
      }
    )
    console.log(
      `Deleted DMARC record for domain ${domainName} (zone ${zoneId})`
    )
  } catch (error) {
    console.error(
      `Failed to delete DNS record for domain ${domainName} (zone ${zoneId}): ${
        error.response
          ? JSON.stringify(error.response.data, null, 2)
          : error.message
      }`
    )
  }
}

const deleteDMARCRecords = async (zoneId, domainName) => {
  try {
    const records = await listDNSRecords(zoneId)

    // Check for existing DMARC records and delete them
    for (const record of records) {
      if (record.name === `_dmarc.${domainName}` || record.name === `_dmarc`) {
        await deleteDNSRecord(zoneId, record.id, domainName)
      }
    }
  } catch (error) {
    console.error(
      `Failed to delete DMARC records for domain ${domainName} (zone ${zoneId}): ${error.message}`
    )
  }
}

;(async () => {
  try {
    const domains = await getAllZones()
    for (const domain of domains) {
      if (!skipDomains.includes(domain.name)) {
        console.log(`Processing domain: ${domain.name} (zone ${domain.id})`)
        await deleteDMARCRecords(domain.id, domain.name)
      } else {
        console.log(`Skipping domain: ${domain.name} (zone ${domain.id})`)
      }
    }
  } catch (error) {
    console.error(`Error: ${error.message}`)
  }
})()
