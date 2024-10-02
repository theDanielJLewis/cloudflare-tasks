require("dotenv").config()
const axios = require("axios")

const apiBaseURL = "https://api.cloudflare.com/client/v4"
const cloudflareApiToken = process.env.CLOUDFLARE_API_TOKEN
const spfRecord = process.env.SPF_RECORD
const dmarcRecord = process.env.DMARC_RECORD
const skipDomains = process.env.SKIP_DOMAINS
  ? process.env.SKIP_DOMAINS.split(",")
  : []

// Retrieve the limit value from the command line arguments
const args = process.argv.slice(2)
const limitArgIndex = args.indexOf("--limit")
const limit =
  limitArgIndex !== -1 ? parseInt(args[limitArgIndex + 1], 10) : null

const getAllZones = async () => {
  let allZones = []
  let page = 1
  let totalPages

  try {
    do {
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

const createDMARCRecord = async (zoneId, domainName) => {
  const recordData = {
    type: "TXT",
    name: "_dmarc",
    content: dmarcRecord,
    ttl: 1, // 1 means 'auto' in Cloudflare API
  }

  try {
    await axios.post(`${apiBaseURL}/zones/${zoneId}/dns_records`, recordData, {
      headers: {
        Authorization: `Bearer ${cloudflareApiToken}`,
        "Content-Type": "application/json",
      },
    })
    console.log(
      `DMARC record created for domain ${domainName} (zone ${zoneId})`
    )
  } catch (error) {
    console.error(
      `Failed to create DMARC record for domain ${domainName} (zone ${zoneId}): ${
        error.response
          ? JSON.stringify(error.response.data, null, 2)
          : error.message
      }`
    )
  }
}

const createSPFRecord = async (zoneId, domainName) => {
  const recordData = {
    type: "TXT",
    name: "@",
    content: spfRecord,
    ttl: 1, // 1 means 'auto' in Cloudflare API
  }

  try {
    await axios.post(`${apiBaseURL}/zones/${zoneId}/dns_records`, recordData, {
      headers: {
        Authorization: `Bearer ${cloudflareApiToken}`,
        "Content-Type": "application/json",
      },
    })
    console.log(`SPF record created for domain ${domainName} (zone ${zoneId})`)
  } catch (error) {
    console.error(
      `Failed to create SPF record for domain ${domainName} (zone ${zoneId}): ${
        error.response
          ? JSON.stringify(error.response.data, null, 2)
          : error.message
      }`
    )
  }
}

const createDKIMRecord = async (zoneId, domainName) => {
  const recordData = {
    type: "TXT",
    name: "*._domainkey",
    content: "v=DKIM1; p=",
    ttl: 1, // 1 means 'auto' in Cloudflare API
  }

  try {
    await axios.post(`${apiBaseURL}/zones/${zoneId}/dns_records`, recordData, {
      headers: {
        Authorization: `Bearer ${cloudflareApiToken}`,
        "Content-Type": "application/json",
      },
    })
    console.log(`DKIM record created for domain ${domainName} (zone ${zoneId})`)
  } catch (error) {
    console.error(
      `Failed to create DKIM record for domain ${domainName} (zone ${zoneId}): ${
        error.response
          ? JSON.stringify(error.response.data, null, 2)
          : error.message
      }`
    )
  }
}

const checkAndCreateSPFRecord = async (zoneId, domainName) => {
  try {
    const records = await listDNSRecords(zoneId)

    // Check for existing SPF records
    const existingSPFRecord = records.find(
      (record) => record.name === "@" && record.content.startsWith("v=spf1")
    )

    if (existingSPFRecord) {
      console.log(`SPF RECORD ALREADY EXISTS: ${domainName} (zone ${zoneId})`)
    } else {
      await createSPFRecord(zoneId, domainName)
    }
  } catch (error) {
    console.error(
      `Failed to check and create SPF record for domain ${domainName} (zone ${zoneId}): ${error.message}`
    )
  }
}

const checkAndCreateDKIMRecord = async (zoneId, domainName) => {
  try {
    const records = await listDNSRecords(zoneId)

    // Check for existing DKIM records
    const existingDKIMRecord = records.find(
      (record) => record.name === "*._domainkey"
    )

    if (existingDKIMRecord) {
      console.log(`DKIM RECORD ALREADY EXISTS: ${domainName} (zone ${zoneId})`)
    } else {
      await createDKIMRecord(zoneId, domainName)
    }
  } catch (error) {
    console.error(
      `Failed to check and create DKIM record for domain ${domainName} (zone ${zoneId}): ${error.message}`
    )
  }
}

const manageDMARCRecord = async (zoneId, domainName) => {
  try {
    const records = await listDNSRecords(zoneId)

    // Check for existing DMARC records
    const existingDMARCRecord = records.find(
      (record) => record.name === "_dmarc"
    )

    if (existingDMARCRecord) {
      console.log(`ALREADY EXISTS: ${domainName} (zone ${zoneId})`)
    } else {
      await createDMARCRecord(zoneId, domainName)
    }

    await checkAndCreateSPFRecord(zoneId, domainName)
    await checkAndCreateDKIMRecord(zoneId, domainName)
  } catch (error) {
    console.error(
      `Failed to manage DMARC record for domain ${domainName} (zone ${zoneId}): ${error.message}`
    )
  }
}

;(async () => {
  try {
    const domains = await getAllZones()
    const domainsToProcess = limit ? domains.slice(0, limit) : domains
    for (const domain of domainsToProcess) {
      if (!skipDomains.includes(domain.name)) {
        await manageDMARCRecord(domain.id, domain.name)
      } else {
        console.log(`Skipping domain: ${domain.name} (zone ${domain.id})`)
      }
    }
  } catch (error) {
    console.error(`Error: ${error.message}`)
  }
})()
