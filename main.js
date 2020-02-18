var Tx = function(tx_json, mempool_data) {
  this.txid = tx_json.txid
  this.raw = tx_json
  this.size = tx_json.size
  this.inputs = tx_json.vin
  this.outputs = tx_json.vout
  this.vsize = tx_json.vsize
  this.weight = tx_json.weight
  this.total_sats = mempool_data.fee * 100000000
  this.time_in_mempool_minutes = Math.round(((new Date()).getTime() / 1000 - mempool_data.time)/60) 
  this.height = mempool_data.height 
  tx_json.vout.forEach( (tx_out) => {
    this.total_sats += tx_out.value * 100000000
  })
  this.feerate = Math.round(mempool_data.fee * 100000000/this.vsize*100)/100 
  this.total_fees = mempool_data.fee* 100000000
  this.fee_percent = Math.round(this.total_fees/this.total_sats*10000)/100
}

$( document ).ready(function() {
  var mempool = {}
  var body_id_to_mempool_id = {} 
  var mempool_id_to_body = {} 
  var Example = Example || {};

    // module aliases
  var Engine = Matter.Engine,
        Render = Matter.Render,
        Runner = Matter.Runner,
        Body = Matter.Body,
        Events = Matter.Events,
        Composite = Matter.Composite,
        Composites = Matter.Composites,
        Common = Matter.Common,
        MouseConstraint = Matter.MouseConstraint,
        Mouse = Matter.Mouse,
        World = Matter.World,
        Bodies = Matter.Bodies;
  // create an engine
  var engine = Engine.create();
  // create a renderer
  var dimWidth = window.innerWidth-60;
  var dimHeight = window.innerHeight;
  var render = Render.create({
      element: $('.vis-target')[0], 
      engine: engine,
      options: {
        width:  dimWidth,
        height: dimHeight,
        wireframes: false,
        pixelRatio: window.devicePixelRatio 
      }
  });
  var b2 = Bodies.rectangle(dimWidth/2, dimHeight, dimWidth, 60, { isStatic: true })
  var b3 = Bodies.rectangle(dimWidth+30, dimHeight*10/2, 60, dimHeight*10, { isStatic: true })
  var b4 = Bodies.rectangle(-30, dimHeight/2*10, 60, dimHeight*10, { isStatic: true })
  b2.staticFriction = 0.75
  b3.staticFriction = 0.75
  b4.staticFriction = 0.75
  World.add(engine.world, [
    b2,b3,b4]);
  
  engine.world.gravity.y = 0.20
  // run the engine
  Engine.run(engine);
  // run the renderer
  Render.run(render);

  setInterval(removeConfirmedTransactions, 30000); 
  removeConfirmedTransactions(true) 
  function colorForFeePerByte(fee_per_byte){
    if (fee_per_byte < 25){
      return "#00" + Math.min(50 + Math.floor(fee_per_byte * 6), 255).toString(16) + "6e" 
    }
    else  {
      return "#" + Math.min(100 + Math.floor((fee_per_byte - 25) * 3), 255).toString(16) + "0000" 
    }
  }
  
  function updateStatus(message) {
    $('#vis-status-update').html(message)
  }
  
  function removePart2FromMemPool(txid) {
    var body = mempool_id_to_body[txid]
    Matter.Composite.remove(engine.world, body)
    delete mempool[txid] 
    delete mempool_id_to_body[txid]
  }
  function removeFromMemPool(txid) {
    if (txid in mempool) {
      var body = mempool_id_to_body[txid]
      if (body) {
        console.log("removing " + txid)
        body.render.lineWidth = 7 
        body.render.strokeStyle = "#8a2be2" 
        setTimeout(function(){ removePart2FromMemPool(txid) }, 10000);
      }
      else {
        delete mempool[txid] 
      }
    }
  }
  var btcPrice = null 
  function updatePrice() {
    $.get('/bitcoin_price.json', function(data, status) {
      btcPrice = data.price
      console.log("btc price " +  btcPrice)
      updateLastBlockInfo()
      updateMempoolInfo()
    })
  }

  setTimeout(updatePrice, 2000);

  function addToMemPool(key, data, isInital, factor) {
    if (!(key in mempool)){
      var fees_per_byte = data.fee* 100000000/data.vsize
      var tx_in_last_48_hours = (((new Date()).getTime() / 1000 - data.time)/60/60/48) < 1.0
      if (Math.random() < factor && tx_in_last_48_hours) { 
        mempool[key] = data
        var size = Math.min(Math.sqrt(data.vsize)*1.25, dimWidth/2)
        if (dimWidth < 1200)
          size *= 0.75
				//var b= Bodies.circle(50 + 1.5*size + Math.floor(Math.random() * dimWidth - 100 - 1.5*size), (-1)*Common.random()*2000, size, { 
        var b= Bodies.rectangle(50 + 1.5*size + Math.floor(Math.random() * dimWidth - 100 - 1.5*size), (-1)*Common.random()*dimHeight/4, size,size, { 
          render: {
           fillStyle: colorForFeePerByte(fees_per_byte),
           strokeStyle: '#fff',
           lineWidth:1 
          }})
        Body.setVelocity(b, { x: Common.random()*10, y: 10 }) 
        body_id_to_mempool_id[b.id] = key
        mempool_id_to_body[key] = b
        //b.frictionAir = 0.10
				b.friction = 0.0
				b.restitution = 1.0 
				b.density = 0.1
        b.render.lineWidth = 5
        b.render.strokeStyle = "#ffaa1d" 
				if (!isInital) {
          setTimeout(function(){ b.render.lineWidth = 1; b.render.strokeStyle = "#fff" }, 10000);
        } 
        else {
          b.render.lineWidth = 1; 
          b.render.strokeStyle = "#fff"
        }
        return b;
      }
      else {
        mempool[key] = data 
      }
      return false 
    }
    return false
  }
 
   
   
  var mConstraint;
  mConstraint = MouseConstraint.create(engine, { element: $('.vis-target')[0] });
  mConstraint.mouse.element.removeEventListener("mousewheel", mConstraint.mouse.mousewheel);
  mConstraint.mouse.element.removeEventListener("DOMMouseScroll", mConstraint.mouse.mousewheel);
   
  Matter.World.add(engine.world, mConstraint);
  var loading = null
  
  var bestHash = '' 
  var bestBlockInfo = {} 
  
  function updateLastBlockInfo() {
    const hash = bestBlockInfo.hash
    if (bestBlockInfo == null)
      return
    $('#block-hash').html(hash)
    const size = bestBlockInfo.strippedsize
    $('#size').html(Math.round(size/1024/1024*1000)/1000 + " MB")
    const height = bestBlockInfo.height
    $('#height').html(height)
    const transactions = bestBlockInfo.tx.length
    $('#transactions').html(transactions)
    const vsize = bestBlockInfo.size
    $('#vsize').html(Math.round(vsize/1024/1024*1000)/1000 + " MB")
    const time_in_mins_ago = Math.round(((new Date()).getTime() / 1000 - bestBlockInfo.time)/60) 
    $('#time').html(time_in_mins_ago + " min ago")
    var total_reward = bestBlockInfo.tx[0].vout[0].value
    $('#reward').html(Math.round(total_reward*100)/100 + " BTC (" + btcToDollars(total_reward) + ")")
    var total_transacted = 0
    bestBlockInfo.tx.forEach((tx) => { 
      tx.vout.forEach((vout) => {
        if (vout.value)
          total_transacted += vout.value
      })
    });
    total_transacted -= total_reward
    $('#total').html(Math.round(total_transacted*100)/100 + " BTC (" + btcToDollars(total_transacted) + ")" )
  }
 
  function updateMempoolInfo() {
    const totalTransactions = Object.keys(mempool).length
    $('#total-pending').html(totalTransactions)
    var vsize = 0 
    var fees = 0
    var total = 0
    Object.keys(mempool).forEach( (txid) => {
      vsize += mempool[txid].vsize
      fees += mempool[txid].fee
    })
    $('#mem-vsize').html(Math.round(vsize/1024/1024*1000)/1000 + " MB")
    $('#mem-reward').html(Math.round(fees*100)/100 + " BTC (" + btcToDollars(fees) + ")")
  }

  function removeConfirmedTransactions(initial) {
    $.get("/best_block_hash.json", function(new_data, status){
      if (new_data.hash != bestHash) {
        $.get("/best_block_txs.json", function(new_data, status){
          if (new_data.hash != bestHash) {
            console.log("BLOCK FOUND. checking new block against mempool")
            bestHash = new_data.hash
            console.log(new_data.tx.length)
            bestBlockInfo = new_data.info
            updateLastBlockInfo()
            if (initial) {
              return 
            }
            updateStatus("New block mined!")
            new_data.tx.forEach( (tx) => {
              removeFromMemPool(tx)
            });
          }
          else {
            updateLastBlockInfo()
            console.log("No new block mined");
          }
        })
      }
    })
  }
 
  function btcToDollars(btc) {
    return "$" + (Math.round(btc * btcPrice * 100)/100).toLocaleString()
  }
  
  function renderTransaction(id, data) {
    loading = id
    $.get("/tx.json?txid=" + id, function(new_data, status){
      if (loading == id) {
        var tx = new Tx(new_data, data);
        $('.info-target').html(
          ` 
          <table class="table table-striped">
            <tr>
              <td>
                TXID
              </td>
              <td style="word-wrap: break-word; max-width: 170;">
                ${tx.txid}
              </td>
            </tr>
            <tr>
              <td>
                Transacted 
              </td>
              <td >
                ${Math.round(tx.total_sats) / 100000000} BTC (${btcToDollars(tx.total_sats / 100000000)})
              </td>
            </tr>
            <tr>
              <td>
                Fee (Reward) Offered 
              </td>
              <td>
                ${tx.total_fees / 100000000} BTC (${btcToDollars(tx.total_fees / 100000000)})
              </td>
            </tr>
            <tr>
              <td>
                Time Broadcasted 
              </td>
              <td>
                ${tx.time_in_mempool_minutes} min ago
              </td>
            </tr>
            <tr>
              <td>
                Fee Rate (Fee/Size) 
              </td>
              <td>
                ${tx.feerate } sats/byte 
              </td>
            </tr>
            <tr>
              <td>
                Fee Percent 
              </td>
              <td>
                ${tx.fee_percent }% 
              </td>
            </tr>
            <tr>
              <td>
                Size (kilobytes) 
              </td>
              <td>
                ${Math.round(tx.vsize / 1024 * 100)/100} KB
              </td>
            </tr>
            <tr>
              <td>
                Num Inputs 
              </td>
              <td>
                ${tx.inputs.length}
              </td>
            </tr>
            <tr>
              <td>
                Num Outputs 
              </td>
              <td>
                ${tx.outputs.length}
              </td>
            </tr>
            <tr>
              <td>
                Height 
              </td>
              <td>
                ${tx.height}
              </td>
            </tr>
          </table>
        `
        )
        $('.info-target').show()
        const max_top = window.innerHeight - $('.info-target').height() - 25
        if ($('.info-target').position().top > max_top){
          $('.info-target')[0].style.top = max_top
        }
        const max_left = window.innerWidth - $('.info-target').width() - 30 
        if ($('.info-target').position().left > max_left ){
          $('.info-target')[0].style.left = max_left 
        }
        $('.info-target').show()
      }
    })
  }
  var initialX,initialY;
  Matter.Events.on(mConstraint, 'mousedown', function (event) {
    initialX = event.mouse.position.x
    initialY = event.mouse.position.y 
  });
 
  //Add event with 'mousemove'
  Matter.Events.on(mConstraint, 'mouseup', function (event) {
    //For Matter.Query.point pass "array of bodies" and "mouse position"
    if (Math.abs(event.mouse.position.x - initialX) > 10 || Math.abs(event.mouse.position.y - initialY) > 10) { 
    }
    const bodies = Composite.allBodies(engine.world);  
    var foundPhysics = Matter.Query.point(bodies, event.mouse.position);
    if (foundPhysics[0]) {
      var active_mempool_id = body_id_to_mempool_id[foundPhysics[0].id]
      if (active_mempool_id) {
        data = mempool[active_mempool_id] 
        renderTransaction(active_mempool_id, data)
        $('.info-target')[0].style.top = event.mouse.position.y - $('body')[0].scrollTop 
        $('.info-target')[0].style.left = event.mouse.position.x - $('body')[0].scrollLeft
        $('.info-target').hide()
      }
      else {
        $('.info-target').hide()
      }
    }
    else {
      $('.info-target').hide()
      var currentY = event.mouse.mousedownPosition.y;
      var deltaY2 = currentY - event.mouse.mouseupPosition.y;
      window.scrollTo(0, deltaY2 + $('body')[0].scrollTop)
    }
  });
  
  function makeAllBodiesStatic(is_static) {
    var bodies = Composite.allBodies(engine.world);

    for (var i = 4; i < bodies.length; i++) {
        var body = bodies[i];
        body.isStatic = is_static 
    }
  }

  var awaitingAdd = []

  function addToWorld() {
    World.add(engine.world, awaitingAdd)
    awaitingAdd = []
  }

  function refreshMemPool(initial) {
    console.log("Refreshing mempool")
    $.get(initial ? "mempool.json" : "mempool-diff.json", function(data, status){
      const mempool_keys = Object.keys(data)
      var toBeAdded = [];
      var newIds = []
      var index;
      var newObject; 
      var totalCount = Object.keys(mempool).length == 0 ? mempool_keys.length : Object.keys(mempool).length
      var p_display = Math.max(1/(mempool_keys.length+1),Math.min(0.15, 0.05*( 1 + Math.log(dimHeight * dimWidth /(480*720))/Math.log(1.2)/10)))
      console.log("P display value: " + p_display)
      var mempoolCount = 0
      for (index = 0; index < mempool_keys.length; index ++) {
        if (!(mempool_keys[index] in mempool))
          mempoolCount += 1
        newObject = addToMemPool(mempool_keys[index], data[mempool_keys[index]], initial, p_display)
        if (newObject) {
          awaitingAdd.push(newObject)
          newIds.push(newObject.id) 
        }
      }
      if (newIds.length > 0) {
        updateStatus(mempoolCount + " transactions added to the mempool (" + awaitingAdd.length + " added to visual)" )
      }
      addToWorld()
      updateMempoolInfo()
    });
  }

  setInterval(refreshMemPool, 10000)
  refreshMemPool(true)

})
