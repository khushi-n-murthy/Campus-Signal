# CampusSignal

Room-by-room 3D map of WiFi and mobile-network quality for a campus.
Full explanation and phase-by-phase build steps: **CampusSignal-Guide.pdf**.

## Quick start (everything already written)

```bash
# 1. server
cd server
npm install
cp .env.example .env          # put your MongoDB connection string in MONGODB_URI
npm run seed:campus           # load data/campus.json
npm run seed:demo             # optional practice data (remove later: npm run purge:demo)

# 2. website
cd ../client
npm install
npm run build

# 3. run + check
cd ../server
npm start                     # http://localhost:4000
npm run verify                # all local STOP checks (phases 0-8)
```

Development with hot reload: `npm run dev` in `server/` and `npm run dev` in `client/`, then open http://localhost:5173.

After deploying: `npm run verify:9 -- https://your-site` from `server/`.
