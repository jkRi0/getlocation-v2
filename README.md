# getlocation-v2
tracking location

## Vercel Edge Config demo

This repo includes:

- `index.html` + `main.js` (browser UI)
- `api/config.js` (Vercel Serverless Function that reads Edge Config)

### Setup

1. Create an Edge Config store in Vercel.
2. Add a key like `publicMessage` (string) to the store.
3. In your Vercel Project Settings, set the environment variable `EDGE_CONFIG` (Vercel provides this value for your store).

### Use

Open the deployed site and click **Load from Edge Config**.

You can request multiple keys by entering comma-separated keys (example: `publicMessage, featureFlag`).



### FAILED, TOO MANY REQUESTS