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
  console.log("Checking peer %s", peer);
  const requestPayload = new Uint8Array(0);
  const started = Date.now();
  try {
    const response = await Zinnia.requestProtocol(peer, "/ipfs/id/1.0.0", requestPayload);
    const chunks = [];
    for await (const c of response) {
      chunks.push(c);
    }

    let result = concatUint8Arrays(chunks);

    // TODO: inspect the Identify response and log the user agent
    // The message is encoded using protobuf, see the proto definition here:
    // https://github.com/libp2p/specs/blob/master/identify/README.md#the-identify-message
    // Zinnia does not support protobuf yet, see
    // https://github.com/filecoin-station/zinnia/issues/160
    //
    // We can inspect the payload using e.g. `protoc`
    //   pbpaste | xxd -r -p | protoc --decode_raw
    // let hex = result.reduce((out, byte) => out + byte.toString(16).padStart(2, "0"), "");
    // console.log("Received Identify Message:", hex);
    // Unfortunately, the data received from libp2p seems to be invalid protobuf payload.
    // We need to investigate this more.
    console.log("Received Identify Message: %s bytes", result.length);
    return { started, online: true };
  } catch (error) {
    console.error("Identify protocol failed:", error);
    return { started, online: false };
  }
}

async function record({ peer, started, online }) {
  const writerUrl = new URL("/api/v2/write", INFLUXDB_ENDPOINT);
  writerUrl.searchParams.set("org", INFLUXDB_ORG_ID);
  writerUrl.searchParams.set("bucket", INFLUXDB_BUCKET);
  writerUrl.searchParams.set("precision", "ms");
  const res = await fetch(writerUrl, {
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
  console.log("Submitted stats to InfluxDB.");
}

function sleep(durationInMs) {
  return new Promise((resolve) => setTimeout(resolve, durationInMs));
}

// Merge an array of Uint8Array instances into a single Uint8Array
function concatUint8Arrays(chunks) {
  // How many bytes we have in total?
  let len = 0;
  for (const c of chunks) len += c.length;

  // Create a new array to hold all bytes
  const result = new Uint8Array(len);

  // Copy data from chunks to the new array
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c;
  }

  return result;
}

while (true) {
  const peer = PEERS[Math.floor(Math.random() * PEERS.length)];

  try {
    const { started, online } = await probe(peer);
    await record({ peer, started, online });
    Zinnia.jobCompleted();
  } catch (err) {
    // TODO: report the error to Sentry
    // TODO: log an activity entry when there are too many errors in a row, e.g. when offline
    console.error("Unexpected error (peer %s): %s", peer, err);
  }

  await sleep(1000);
}
