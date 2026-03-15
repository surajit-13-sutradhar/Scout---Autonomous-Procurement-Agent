# Scout — Autonomous Procurement Agent

Scout is an autonomous procurement intelligence agent designed to automate corporate purchasing research. It leverages the TinyFish Web Agent API to instantly spin up parallel, real-browser agents that independently search multiple retail sites (e.g., Amazon, Staples, Office Depot, Walmart), extract real-time pricing and availability data, and intelligently recommend the best overall savings based on quantity and instructions.

## Features

* **Real-time Price Engine**: Runs parallel web agents simultaneously to check current prices across your chosen vendors.
* **Bulk & Instructions Support**: Capable of reading explicit user instructions, seeking out bulk discounts, and checking shipping specifications automatically.
* **Cost Insight & Savings**: Automatically calculates total budget and surfaces the lowest price, highest price, and exact percentage saved.
* **One-Click Export**: Easily export the compiled findings to a structured CSV file for procurement documentation.
* **Template Driven**: Ships with instant templates for common procurement categories like Office Supplies, Electronics, Packaging, and SaaS.

## Technologies Used

* **Frontend**: HTML5, Vanilla JavaScript, CSS variables (No-build frameworkless architecture).
* **Backend Proxy**: Node.js, Express.js.
* **Intelligence Layer**: TinyFish Autonomous Web Agent API (with a seamless fallback to Claude Web Search API if the proxy is unavailable).

## Installation Instructions

To protect your API keys and handle browser CORS policies natively, Scout relies on a lightweight Node.js proxy backend.

1. **Clone or Download** the project to your local machine.
2. **Install dependencies**: Ensure you have [Node.js](https://nodejs.org/) installed, then run the following in your terminal:
   ```bash
   npm install express node-fetch
   ```
3. **Start the Proxy Server**: Securely bridge the frontend requests to TinyFish by running:
   ```bash
   node server.js
   ```
   *You should see a message indicating the server is running on `http://localhost:3000`.*
4. **Open the Agent**: In your web browser, navigate to the local instance (e.g., `http://localhost:3000/scout-procurement-agent.html`).

## Usage Examples

1. **Enter your API Key**: Start by pasting your `TinyFish API Key` (beginning with `tf_live_`) in the sidebar configuration input.
2. **Configure a Goal**: Enter a specific product (e.g., *HP 26A Black LaserJet Toner Cartridge*), the desired quantity (e.g., *24 units*), and budget constraint.
3. **Select Sites**: Click on the retailer chips (e.g., Amazon, Staples) to target those specific vendors.
4. **Run Scout**: Click `▶ Run Scout`. The dashboard will visualize the real-time parallel streams, log the underlying browser agent steps, and eventually present a structured comparison matrix along with a calculated savings insight.
5. **Export Data**: Once the job has finished, click `↓ Export CSV` to take the pricing matrix into Excel or Google Sheets.

## Contributing Guidelines

TBD

## License Information

TBD

## Acknowledgments/Credits

* Powered by the [TinyFish Automation API](https://agent.tinyfish.ai).
* Fonts provided by [Google Fonts](https://fonts.google.com) (DM Mono, Fraunces, DM Sans).
