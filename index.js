var express = require('express');
var app = express();
var http = require('http');
const TxDecoder = require('./models/txdecoder') 

const got = require('got');
const cron = require('node-cron');

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html')
});
app.get('/simulated_best_block_txs.json', function(req, res) {
  var out = []
  for (var id in mempool) {
    if (Math.random() > 0.3) {
      out.push(mempool[id].wtxid)
    }
  }
  res.json({ tx: out, hash: Math.random() + chainInfo.bestblockhash })
});
app.get('/best_block_txs.json', function(req, res) {
  var out = []
  for (var id in bestBlockData.tx) {
    out.push(bestBlockData.tx[id].txid)
  }
  //for (var id in mempool) {
  //  out.push(mempool[id].wtxid)
  //}
  res.json({ tx: out, hash: chainInfo.bestblockhash, info: bestBlockData })
});
app.get('/mempool.json', function(req, res) {
  res.json(mempool) 
});

app.get('/main.js', function (req, res) {
  res.sendFile(__dirname + '/main.js')
});

app.get('/tx.json', (req, response) => {
  data = {}
  url = "http://54.84.29.65:8332/rest/tx/"+ req.query.txid + '.json'
  http.get(url, (res) => {
    var body = '';

    res.on('data', function(chunk){
        body += chunk;
    });

    res.on('end',  () => {
        data = JSON.parse(body);
        response.json(data) 
    });
  }).on('error', function(e){
        console.log("Got an error: ", e);
        response.json({error: error}) 
  });
});
app.get('/matter.min.js', function (req, res) {
  res.sendFile(__dirname + '/node_modules/matter-js/build/matter.min.js')
});
app.listen(3010, function () {
});

var mempool = {} 
var chainInfo = {}
function refreshMempool() {
  console.log("refreshing")
  http.get('http://54.84.29.65:8332/rest/mempool/contents.json', function(res){
      var body = '';

      res.on('data', function(chunk){
          body += chunk;
      });

      res.on('end', function(){
          mempool = JSON.parse(body);
          console.log("Updated mempool");
      });
  }).on('error', function(e){
        console.log("Got an error: ", e);
  });
};
var bestBlockData = {}
function refreshLastBlock() {
  const blockhash = chainInfo.bestblockhash
  if (blockhash) {
    http.get('http://54.84.29.65:8332/rest/block/' + blockhash + '.json', function(res){
      var body = '';

      res.on('data', function(chunk){
          body += chunk;
      });

      res.on('end', function(){
        bestBlockData = JSON.parse(body)
      });
    }).on('error', function(e){
          console.log("Got an error: ", e);
    });
  }
}
function refreshChainInfo() {
  http.get('http://54.84.29.65:8332/rest/chaininfo.json', function(res){
    var body = '';

    res.on('data', function(chunk){
        body += chunk;
    });

    res.on('end', function(){
      const oldHash = chainInfo.bestblockhash
      chainInfo = JSON.parse(body)
      if (oldHash != null && oldHash != chainInfo.bestblockhash ) {
        mempool = {}
        refreshMempool() 
      }
      refreshLastBlock()
    });
  }).on('error', function(e){
        console.log("Got an error: ", e);
  });
};

refreshMempool();
refreshChainInfo()
cron.schedule('* * * * *', () => { 
  refreshMempool()
  refreshChainInfo()
});
