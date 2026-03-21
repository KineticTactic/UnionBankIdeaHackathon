const express = require("express");

module.exports = function createEnrichmentRouter(stores) {
  const router = express.Router();

  // GET /api/enrichment/:customer_id - Full enrichment object
  router.get("/:customer_id", (req, res) => {
    const customerId = req.params.customer_id;
    const enrichment = stores.enrichment.map.get(customerId);

    if (!enrichment) {
      return res.status(404).json({
        status: "error",
        message: `Enrichment data for customer ${customerId} not found`,
      });
    }

    res.json({
      status: "ok",
      data: enrichment,
    });
  });

  // GET /api/enrichment/:customer_id/employer - Employer info only
  router.get("/:customer_id/employer", (req, res) => {
    const customerId = req.params.customer_id;
    const enrichment = stores.enrichment.map.get(customerId);

    if (!enrichment) {
      return res.status(404).json({
        status: "error",
        message: `Enrichment data for customer ${customerId} not found`,
      });
    }

    res.json({
      status: "ok",
      data: {
        linkedin_employer: enrichment.linkedin_employer,
        linkedin_title: enrichment.linkedin_title,
        linkedin_updated_at: enrichment.linkedin_updated_at,
      },
    });
  });

  // GET /api/enrichment/:customer_id/credit - Credit info only
  router.get("/:customer_id/credit", (req, res) => {
    const customerId = req.params.customer_id;
    const enrichment = stores.enrichment.map.get(customerId);

    if (!enrichment) {
      return res.status(404).json({
        status: "error",
        message: `Enrichment data for customer ${customerId} not found`,
      });
    }

    res.json({
      status: "ok",
      data: {
        credit_score: enrichment.credit_score,
        credit_score_band: enrichment.credit_score_band,
        income_estimate: enrichment.income_estimate,
      },
    });
  });

  // GET /api/enrichment/market-signals - Market signals by city/segment
  router.get("/market-signals", (req, res) => {
    const { city, segment } = req.query;

    const signals = [];

    stores.enrichment.map.forEach((enrichment, customerId) => {
      const customer = stores.customers.map.get(customerId);
      if (!customer) return;

      // Filter by city and/or segment
      if (city && customer.city !== city) return;
      if (segment && customer.segment !== segment) return;

      if (enrichment.news_risk_flag) {
        signals.push({
          customer_id: customerId,
          city: customer.city,
          segment: customer.segment,
          news_risk_flag: enrichment.news_risk_flag,
          news_summary: enrichment.news_summary,
        });
      }
    });

    res.json({
      status: "ok",
      count: signals.length,
      data: signals,
    });
  });

  return router;
};
