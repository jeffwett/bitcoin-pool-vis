var Tx = function(tx_json, mempool_data) {
  this.txid = tx_json.txid
  this.raw = tx_json
  this.size = tx_json.size
  this.inputs = tx_json.vin
  this.outputs = tx_json.vout
  this.vsize = tx_json.vsize
  this.weight = tx_json.weight
  this.total_sats = mempool_data.descendantfees 
  this.time_in_mempool_minutes = Math.round(((new Date()).getTime() / 1000 - mempool_data.time)/60) 
  this.height = mempool_data.height 
  tx_json.vout.forEach( (tx_out) => {
    this.total_sats += tx_out.value * 100_000_000
  })
  this.feerate = Math.round(mempool_data.descendantfees/this.vsize*100)/100 
  this.total_fees = mempool_data.descendantfees
  this.fee_percent = Math.round(this.total_fees/this.total_sats*100_00)/100
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
  var dimWidth = window.innerWidth;
  var dimHeight = window.innerHeight;
  var render = Render.create({
      element: $('.vis-target')[0], 
      engine: engine,
      options: {
        width:  dimWidth,
        height: dimHeight,
        wireframes: false,
        pixelRatio: 4
      }
  });
  var b1 = Bodies.rectangle(dimWidth/2, 0, dimWidth, 30, { isStatic: true })
  var b2 = Bodies.rectangle(dimWidth/2, dimHeight, dimWidth, 30, { isStatic: true })
  var b3 = Bodies.rectangle(dimWidth, dimHeight/2, 30, dimHeight, { isStatic: true })
  var b4 = Bodies.rectangle(0, dimHeight/2, 30, dimHeight , { isStatic: true })
  b1.restitution = 1 
  b2.restitution = 1
  b3.restitution = 1 
  b4.restitution = 1
  World.add(engine.world, [
    b1,b2,b3,b4]);

  engine.world.gravity.y = 0;
  // run the engine
  Engine.run(engine);
  // run the renderer
  Render.run(render);

  var explosion = function(engine, newIds, power, all) {
        var bodies = Composite.allBodies(engine.world);
        
        for (var i = 0; i < bodies.length; i++) {
            var body = bodies[i];
          
            if (!body.isStatic && (all || newIds.includes(body.id))) {
                var forceMagnitude = (power || 0.004) * body.mass;

                Body.applyForce(body, body.position, {
                    x: (forceMagnitude + Common.random() * forceMagnitude) * Common.choose([1, -1]), 
                    y: (forceMagnitude + Common.random() * forceMagnitude) * Common.choose([1, -1])
                });
            }
        }
    };

    
  $(window).scroll(function(event) {
    //if (!event.target || event.target.id != "info-target") {
    //  $('.info-target').hide() 
    //  makeAllBodiesStatic(false)
    //}
  });


  setInterval(function(){ explosion(engine, [], 0.001, true) }, 10000);
  setInterval(removeConfirmedTransactions, 30000); 
  
  function colorForFeePerByte(fee_per_byte){
    if (fee_per_byte < 15){
      return "#00" + Math.min(100 + Math.floor(fee_per_byte * 10), 255).toString(16) + "6e" 
    }
    else  {
      return "#" + Math.min(100 + Math.floor(fee_per_byte * 3), 255).toString(16) + "0000" 
    }
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
        body.render.lineWidth = 10 
        body.render.strokeStyle = "#00ff00" 
        setTimeout(function(){ removePart2FromMemPool(txid) }, 10000);
      }
      else {
        delete mempool[txid] 
      }
    }
  }
  function addToMemPool(key, data, isInital, factor) {
    if (!(key in mempool)){
      var fees_per_byte = data.descendantfees/data.descendantsize
      if (Math.random() < factor) { 
        mempool[key] = data
        var size = Math.sqrt(data.descendantsize)/3
        //var b= Bodies.polygon(Math.floor(Math.random() * 3200), Math.floor(Math.random() * 2400), 4, size, { 
        var b= Bodies.rectangle(Math.floor(Math.random() * dimWidth), Math.floor(Math.random() * dimHeight), size,size, { 
          render: {
           fillStyle: colorForFeePerByte(fees_per_byte),
           strokeStyle: '#fff',
           lineWidth:1 
          }})
        Body.setVelocity(b, { x: Common.choose([1, -1]), y: Common.choose([1,-1])})
        body_id_to_mempool_id[b.id] = key
        mempool_id_to_body[key] = b
        b.frictionAir = 0.0
        b.friction = 0.0
        b.restitution = 0.7 
        b.mass = data.descendantsize
        b.render.lineWidth = 5
        b.render.strokeStyle = "#0000ff" 
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
        mempool[key] = true
      }
      return false 
    }
    return false
  }
 
   var mConstraint;
  mConstraint = MouseConstraint.create(engine);
  Matter.World.add(engine.world, mConstraint);
  var loading = null
  
  var bestHash = '' 
  function removeConfirmedTransactions() {
    $.get("/best_block_txs.json", function(new_data, status){
      if (new_data.hash != bestHash) {
        console.log("BLOCK FOUND. checking new block against mempool")
        bestHash = new_data.hash
        console.log(new_data.tx.length)
        new_data.tx.forEach( (tx) => {
          removeFromMemPool(tx)
        });
      }
      else {
        console.log("No new block mined");
      }
    })
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
                ID
              </td>
              <td>
                ${tx.txid}
              </td>
            </tr>
            <tr>
              <td>
                Transacted 
              </td>
              <td>
                ${tx.total_sats / 100_000_000} BTC
              </td>
            </tr>
            <tr>
              <td>
                Fee (Reward) Offered 
              </td>
              <td>
                ${tx.total_fees / 100_000_000} BTC
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

  var initialX, initialY = null 
  $('.vis-target').on('mousedown touchstart', function(event) {
    initialX |= event.clientX || event.touches[0].clientX
    initialY |= event.clientY || event.touches[0].clientY
  })

  //Add event with 'mousemove'
  $(".vis-target").on("mouseup touchend", function (event) {
    newX = event.clientX || event.touches[0].clientX
    newY = event.clientY || event.touches[0].clientY
    if (Math.abs(initialX - newX) > 20 || Math.abs(initialY - newY) > 20) { 
      return;
    }
    initialY = initialX = null
    //For Matter.Query.point pass "array of bodies" and "mouse position"
    const bodies = Composite.allBodies(engine.world);  
    x = newX 
    y = newY 
    var foundPhysics = Matter.Query.point(bodies, {x, y });

    if (foundPhysics[0]) {
      var active_mempool_id = body_id_to_mempool_id[foundPhysics[0].id]
      if (active_mempool_id) {
        data = mempool[active_mempool_id] 
        renderTransaction(active_mempool_id, data)
        $('.info-target')[0].style.top = y - $('body')[0].scrollTop 
        $('.info-target')[0].style.left = x - $('body')[0].scrollLeft
        $('.info-target').hide()
        makeAllBodiesStatic(true)
      }
      else {
        $('.info-target').hide()
        makeAllBodiesStatic(false)
      }
    }
    else {
      $('.info-target').hide()
      makeAllBodiesStatic(false)
    }
  });
  
  function makeAllBodiesStatic(is_static) {
    var bodies = Composite.allBodies(engine.world);

    for (var i = 4; i < bodies.length; i++) {
        var body = bodies[i];
        body.isStatic = is_static 
    }
  }

  function refreshMemPool(initial) {
    console.log("Refreshing mempool")
    $.get("mempool.json", function(data, status){
      const mempool_keys = Object.keys(data)
      var toBeAdded = [];
      var newIds = []
      var index;
      var newObject; 
      var totalCount = Object.keys(mempool).length == 0 ? mempool_keys.length : Object.keys(mempool).length
      var p_display = 1000 / totalCount * ( 1 + Math.log(dimHeight * dimWidth /(480*720))/Math.log(1.2)/10)
      console.log("P display value: " + p_display)
      for (index = 0; index < mempool_keys.length; index ++) {
        newObject = addToMemPool(mempool_keys[index], data[mempool_keys[index]], initial, p_display)
        if (newObject) {
          toBeAdded.push(newObject)
          newIds.push(newObject.id) 
        }
      }
      World.add(engine.world, toBeAdded);
      if (toBeAdded.length > 0) {
        explosion(engine, newIds, 0.008)
      }
      console.log("Added to mempool: " + toBeAdded.length)
    });
  
  }

  setInterval(refreshMemPool, 30000)
  refreshMemPool(true)

})
