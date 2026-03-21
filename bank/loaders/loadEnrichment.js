const fs = require("fs");
const path = require("path");

module.exports = async function loadEnrichment() {
  const filePath = path.join(__dirname, "../data/enrichment.json");

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const enrichmentMap = new Map();

  Object.entries(data).forEach(([customerId, enrichmentData]) => {
    enrichmentMap.set(customerId, enrichmentData);
  });

  return {
    map: enrichmentMap,
    count: enrichmentMap.size,
  };
};
