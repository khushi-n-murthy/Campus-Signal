// Phase 2: the IP -> network detection gives the right answer for every operator.
import { title, section, check, warn, finish, expectEqual } from './lib.js';
import { config } from '../src/config.js';
import { classifyIp, normalizeIp, buildCampusList } from '../src/carrier.js';
import { openAsnDatabase } from '../src/asn.js';

title(2, 'Carrier detection', 'Given only an IP address, the server names the network correctly (Jio, Airtel, Vi, BSNL, campus WiFi, local).');

section('IP clean-up');
await check('Plain IPv4 is kept', () => expectEqual(normalizeIp('49.36.0.1'), '49.36.0.1'));
await check('IPv4 written as IPv6 (::ffff:) is unwrapped', () => expectEqual(normalizeIp('::ffff:49.36.0.1'), '49.36.0.1'));
await check('IPv6 is kept', () => expectEqual(normalizeIp('2409:4040::1'), '2409:4040::1'));
await check('Garbage is rejected', () => expectEqual(normalizeIp('not-an-ip'), null));

section('GeoLite2-ASN database');
let asn = null;
await check('Database downloads and opens', async () => {
  asn = await openAsnDatabase();
  return true;
}, 'Needs internet the first time. Run npm run preload, then this phase again. Behind a firewall, allow github.com');

// Sample addresses inside each operator's registered blocks (checked against GeoLite2, Oct 2026).
const SAMPLES = [
  ['49.36.0.1', 'Jio'],
  ['157.32.0.1', 'Jio'],
  ['2409:4040::1', 'Jio'],
  ['106.192.0.1', 'Airtel'],
  ['223.176.0.1', 'Airtel'],
  ['117.96.0.1', 'Airtel WiFi'],
  ['1.38.100.1', 'Vi'],
  ['42.104.0.1', 'Vi'],
  ['2402:3a80::1', 'Vi'],
  ['117.192.0.1', 'BSNL'],
  ['8.8.8.8', 'Other'],
];
if (asn) {
  section('Each operator');
  let movedBlocks = 0;
  for (const [ip, expected] of SAMPLES) {
    const ok = await check(`${ip} -> ${expected}`, () => {
      const r = classifyIp(ip, asn.lookup);
      if (r.carrier !== expected) throw new Error(`got ${r.carrier} (ASN ${r.asn}, ${r.org})`);
      return `AS${r.asn}`;
    }, 'If the ASN shown belongs to the same operator, add it to ASN_TO_CARRIER in src/carrier.js');
    if (!ok) movedBlocks += 1;
  }
  if (movedBlocks === 1) warn('Only one sample failed: operators occasionally move IP blocks. If the others pass, your code is right.');
}

section('Special addresses');
await check('127.0.0.1 -> Local network', () => expectEqual(classifyIp('127.0.0.1', asn?.lookup).carrier, 'Local network'));
await check('192.168.1.20 -> Local network (phone on your home/lab router)', () => expectEqual(classifyIp('192.168.1.20', asn?.lookup).carrier, 'Local network'));
await check('::ffff:10.1.2.3 -> Local network', () => expectEqual(classifyIp('::ffff:10.1.2.3', asn?.lookup).carrier, 'Local network'));
await check('A lookup error is handled (no crash)', () => expectEqual(classifyIp('49.36.0.1', () => { throw new Error('boom'); }).carrier, 'Other'));

section('Campus WiFi ranges (CAMPUS_CIDRS)');
await check('An address inside a campus range -> Campus WiFi, even if the ISP is Jio', () => {
  const list = buildCampusList(['49.36.0.0/24']);
  return expectEqual(classifyIp('49.36.0.77', asn?.lookup, list).carrier, 'Campus WiFi');
});
await check('An address outside the campus range keeps its operator', () => {
  const list = buildCampusList(['49.36.0.0/24']);
  return expectEqual(classifyIp('49.36.1.77', asn?.lookup, list).carrier, asn ? 'Jio' : 'Other');
});
await check('Your CAMPUS_CIDRS in .env are valid', () => {
  buildCampusList(config.campusCidrs);
  return config.campusCidrs.length ? config.campusCidrs.join(', ') : 'empty (allowed)';
}, 'Each entry must look like 203.0.113.7/32; separate entries with commas');
if (!config.campusCidrs.length) {
  warn('To fill CAMPUS_CIDRS: on campus WiFi open <your site>/api/whoami, copy "ip", add it as ip/32 in .env.');
}

asn?.close();
finish(2, 'Phase 3 (npm run verify:3)');
