// Works out which network a phone is on from its public IP address.
import net from 'node:net';

// Autonomous System Numbers (ASNs) registered to each Indian operator (source: APNIC).
export const ASN_TO_CARRIER = {
  55836: 'Jio',
  45609: 'Airtel',
  24560: 'Airtel WiFi', // Airtel broadband / Xstream fibre
  38266: 'Vi',
  45271: 'Vi',
  55410: 'Vi',
  55644: 'Vi',
  9829: 'BSNL',
};

// Networks shown in the app, in display order.
export const CARRIERS = ['Jio', 'Airtel', 'Vi', 'BSNL', 'Campus WiFi', 'Airtel WiFi', 'Other'];

const PRIVATE = new net.BlockList();
PRIVATE.addSubnet('10.0.0.0', 8, 'ipv4');
PRIVATE.addSubnet('172.16.0.0', 12, 'ipv4');
PRIVATE.addSubnet('192.168.0.0', 16, 'ipv4');
PRIVATE.addSubnet('127.0.0.0', 8, 'ipv4');
PRIVATE.addSubnet('169.254.0.0', 16, 'ipv4');
PRIVATE.addSubnet('100.64.0.0', 10, 'ipv4'); // carrier-grade NAT range
PRIVATE.addAddress('::1', 'ipv6');
PRIVATE.addSubnet('fc00::', 7, 'ipv6');
PRIVATE.addSubnet('fe80::', 10, 'ipv6');

// "::ffff:1.2.3.4" (IPv4 written as IPv6) -> "1.2.3.4". Returns null when it is not an IP.
export function normalizeIp(ip) {
  if (typeof ip !== 'string') return null;
  let s = ip.trim();
  if (s.toLowerCase().startsWith('::ffff:') && net.isIPv4(s.slice(7))) s = s.slice(7);
  return net.isIP(s) ? s : null;
}

function family(ip) {
  return net.isIPv4(ip) ? 'ipv4' : 'ipv6';
}

// cidrs: ["203.0.113.0/28", "2001:db8::/48"] -> a BlockList that can test addresses.
export function buildCampusList(cidrs) {
  const list = new net.BlockList();
  for (const c of cidrs) {
    const [addr, bits] = c.split('/');
    const clean = normalizeIp(addr);
    if (!clean || bits === undefined) throw new Error(`Bad CIDR in CAMPUS_CIDRS: ${c}`);
    list.addSubnet(clean, Number(bits), family(clean));
  }
  return list;
}

// lookup(ip) must return a MaxMind ASN record ({ autonomous_system_number, autonomous_system_organization }) or null.
export function classifyIp(rawIp, lookup, campusList = null) {
  const ip = normalizeIp(rawIp);
  if (!ip) return { ip: null, asn: null, org: null, carrier: 'Other' };
  if (campusList && campusList.check(ip, family(ip))) {
    return { ip, asn: null, org: null, carrier: 'Campus WiFi' };
  }
  if (PRIVATE.check(ip, family(ip))) {
    return { ip, asn: null, org: null, carrier: 'Local network' };
  }
  let record = null;
  try {
    record = lookup ? lookup(ip) : null;
  } catch {
    record = null;
  }
  const asn = record?.autonomous_system_number ?? null;
  const org = record?.autonomous_system_organization ?? null;
  return { ip, asn, org, carrier: ASN_TO_CARRIER[asn] ?? 'Other' };
}
