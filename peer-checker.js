const INFLUXDB_API_KEY =
  "Eg5BExxDb61LNosjnCsa0l-0PMRlzm8jUS_vXLuVWt_ApcxBhvpaga_rlUPpNhig7n0lCq_Xz5z1KqSZsYdDcQ==";
const INFLUXDB_ORG_ID = "1ccca9b7fbbf257d";
const INFLUXDB_BUCKET = "peer-checker";
const INFLUXDB_ENDPOINT = "https://eu-central-1-1.aws.cloud2.influxdata.com/";

// List of peers to ping
const PEERS = [
  // Punchr bootstrap nodes
  // https://github.com/libp2p/punchr/blob/b43900e079e654b964531ea6a0b4531c18265b8e/rust-client/src/main.rs#L275-L287
  "/ip4/139.178.91.71/tcp/4001/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
  "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
  "/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
  "/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt",

  // https://github.com/mxinden/kademlia-exporter/blob/9fea15bc50ae50637033d5437ebb21aa53959e73/config.toml#L6-L9
  "/ip4/139.178.91.71/tcp/4001/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",

  // ipfs bootstrap
  "/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa",
  "/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ",
];

async function probe(peer) {
  const requestPayload = new Uint8Array(0);
  const started = Date.now();
  try {
    const response = await Zinnia.requestProtocol(peer, "/ipfs/id/1.0.0", requestPayload);
    const chunks = [];
    for await (const c of response) {
      chunks.push(c);
    }

    let result = concatUint8Arrays(chunks);
    return { started, result };
  } catch (error) {
    return { started, error };
  }
}

async function record({ peer, started, online }) {
  const request_url = new URL("/api/v2/write", INFLUXDB_ENDPOINT);
  request_url.searchParams.set("org", INFLUXDB_ORG_ID);
  request_url.searchParams.set("bucket", INFLUXDB_BUCKET);
  request_url.searchParams.set("precision", "ms");
  const res = await fetch(request_url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Token ${INFLUXDB_API_KEY}`,
      "Content-Type": "text/plain; charset=utf-8",
    },
    body: `check,peer=${peer} online=${online ? 1 : 0}u ${started}\n`,
  });
  if (!res.ok) {
    throw new Error(`InfluxDB API error ${res.status}\n${await res.text()}`);
  }
}

function sleep(durationInMs) {
  return new Promise((resolve) => setTimeout(resolve, durationInMs));
}

// Merge an array of Uint8Array instances into a single Uint8Array
function concatUint8Arrays(chunks) {
  let len = 0;
  for (const c of chunks) len += c.length;
  const result = new Uint8Array(len);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c;
  }
  return result;
}

while (true) {
  const peer = PEERS[Math.floor(Math.random() * PEERS.length)];

  let checkResult;

  try {
    console.log("Checking %s", peer);
    checkResult = await probe(peer);
    const { result, error } = checkResult;
    if (result) {
      // TODO: inspect the Identify response and log the user agent
      // https://github.com/libp2p/specs/blob/master/identify/README.md#the-identify-message
      // We can inspect the payload using e.g. `protoc`
      //   pbpaste | xxd -r -p | protoc --decode_raw
      // let hex = result.reduce((out, byte) => out + byte.toString(16).padStart(2, "0"), "");
      // console.log("Received Identify Message:", hex);
      // Unfortunately, the data received from libp2p are not
      console.log("Recevied Identify Message: %s bytes", result.length);
    } else {
      console.error("Identify protocol failed:", error);
    }
  } catch (err) {
    console.error("Unexpected error (peer %s): %s", peer, err);
  }

  try {
    await record({ peer, started: checkResult.started, online: !!checkResult.result });
    console.log("Submitted stats to InfluxDB.");
  } catch (err) {
    console.error("Cannot record stats: %s", err);
  }

  Zinnia.jobCompleted();

  await sleep(1000);
}
