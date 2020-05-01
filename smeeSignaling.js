import jsonp from "./jsonp.js";
window.jsonp = jsonp;
function getCallback(channel) {
  return new Promise(callback => {
    let es = new EventSource(channel);
    es.onmessage = function(e) {
      try {
        let response = JSON.parse(e.data).body;
        if (response.type == "callback") {
          es.close();
          callback(response.answer);
        }
      } catch (e) {
        console.error(e);
      }
    };
  });
}

function sendCallback(channel, answer) {
  fetch("https://cors-anywhere.herokuapp.com/"+channel, {
    method: "post",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    mode:"cors",
    body: JSON.stringify({ type: "callback", answer })
  });
}

async function makeChannel() {
  return (
    "https://smee.io/" +
    (await fetch(
      "https://cors-anywhere.herokuapp.com/https://smee.io/new"
    )).url.split("smee.io/")[1]
  );
}

async function getAnswer(offer) {
  let channel = await makeChannel();
  let url = new URL("https://p2p-webchat.glitch.me/signalingdata");
  url.searchParams.set("smeeChannel", channel);
  url.searchParams.set("offer", offer);
  let code = (await jsonp(
    "https://is.gd/create.php?format=json&url=" + encodeURIComponent(url.href)
  )).shorturl.split("is.gd/")[1];
  return { code, channel };
}

async function getInfo(code) {
  let info = new URL(
    (await jsonp(
      "https://is.gd/forward.php?format=json&shorturl=" +
        encodeURIComponent(code)
    )).url.replace(/\&amp\;/gi, "&")
  ).searchParams;

  return {
    channel: info.get("smeeChannel"),
    offer: info.get("offer")
  };
}
export default function sig(p) {
  let sender = async m => prompt("Please send this code to the other peer", m);
  let asker = async m => prompt("Please paste the code from the other peer");
  let init = async () => {
    let isHost = p.initiator;
    let smeeChannel;
    if (!isHost) {
      let code = await asker();
      let i = await getInfo(code);
      smeeChannel = i.channel;
      p.signal(JSON.parse(i.offer));
    }
    p.on("signal", async data => {
      data = JSON.stringify(data);
      if (isHost) {
        let { code, channel } = await getAnswer(data);
        sender(code);
        let answer = await getCallback(channel);
        p.signal(JSON.parse(answer));
      } else {
        sendCallback(smeeChannel, data);
      }
    });
  };
  return {
    setSender: s => {
      sender = s;
    },
    setAsker: s => {
      asker = s;
    },
    init
  };
}
