# 🧬 FDA & Clinical Trials Token-Optimized Data API (MCP Server)

A high-performance, token-optimized Data-as-a-Service (DaaS) platform providing real-time clinical trial data directly to AI agents and MCP clients. Designed to strip away verbose markup and deliver structured, compact JSON optimized for low-token context consumption.

---

## 🚀 Quick Start for AI Agents & Developers

This service is registered on the [Smithery.ai](https://smithery.ai) registry and is fully compliant with the Model Context Protocol (MCP).

* **Base Production URL:** `https://your-vercel-deployment.vercel.app`
* **Primary Endpoint:** `/api/v1/niche-data`

---

## 📡 API Usage & Parameters

### Query Clinical Trials
Fetch real-time, compact clinical trial records formatted for LLM consumption.

* **Endpoint:** `GET /api/v1/niche-data`
* **Query Parameters:**
  * `q` (string, required): Search keyword or condition (e.g., `?q=oncology`). *Note: Missing `q` returns a `400` status and incurs no charge.*

#### Example Request:
```bash
curl -X GET "[https://your-vercel-deployment.vercel.app/api/v1/niche-data?q=diabetes](https://your-vercel-deployment.vercel.app/api/v1/niche-data?q=diabetes)"
