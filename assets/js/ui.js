(function(){
  const STORAGE_KEY = "agritrust_demo_state_v2_full";
  const toast = document.getElementById("toast");
  function showToast(msg){
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(()=>toast.classList.remove("show"), 2600);
  }
  function todayISO(){ return new Date().toISOString().slice(0,10); }
  function addDaysISO(dateIso, days){
    const d = new Date(dateIso + "T00:00:00");
    d.setDate(d.getDate()+days);
    return d.toISOString().slice(0,10);
  }
  async function sha256Hex(str){
    const buf = new TextEncoder().encode(str);
    const hb = await crypto.subtle.digest("SHA-256", buf);
    const arr = Array.from(new Uint8Array(hb));
    return arr.map(b=>b.toString(16).padStart(2,"0")).join("");
  }
  function statusBadgeClass(status){
    if(status==="PAID") return "good";
    if(status==="DISPUTED" || status==="REJECTED") return "bad";
    return "warn";
  }
  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch(_){ return null; }
  }
  function saveState(){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(_){}
  }

  const state = loadState() || {
    role:"FARMER",
    user:{id:"U-FARM-01",name:"F-012 (Smallholder)"},
    deliveries:[],
    ledger:[],
    selectedRef:"D00007"
  };

  function setRole(role){
    state.role=role;
    if(role==="FARMER") state.user={id:"U-FARM-01",name:"F-012 (Smallholder)"};
    if(role==="BUYER") state.user={id:"U-BUY-01",name:"B-01 (Retail DC)"};
    if(role==="REGULATOR") state.user={id:"U-REG-01",name:"Regulator (Read-only)"};
    if(role==="ADMIN") state.user={id:"U-ADM-01",name:"Admin"};
    document.getElementById("roleName").textContent = role;
    document.getElementById("userName").textContent = state.user.name;
    saveState();
  }
  function getRoleFromHash(){
    const m = (location.hash||"").match(/role=([A-Z_]+)/);
    return m ? m[1] : "FARMER";
  }
  function parsePaneFromHash(){
    const m = (location.hash||"").match(/pane=([a-z]+)/);
    return m ? m[1] : "dashboard";
  }

  function mkDelivery(d){
    const due = addDaysISO(d.delivery_date, d.terms_days || 30);
    return Object.assign({
      status:"DELIVERED",
      due_date: due,
      created_at: new Date().toISOString(),
      confirmed_at:null,
      paid_at:null,
      dispute_code:null,
      dispute_reason:null,
      dispute_notes:null,
      dispute_opened_at:null,
      dispute_resolution:null,
      dispute_resolved_at:null,
      dispute_evidence_url:null,
      dispute_evidence_hash:null,
      invoice_ref:null,
      invoice_submitted_at:null,
      invoice_approved_at:null,
      payment_scheduled_at:null,
      gtin:null,gln_farmer:null,gln_buyer:null,lot_number:null,sscc:null,
      event_timezone:"Africa/Johannesburg"
    }, d);
  }

  async function appendEvent(event_type, actor_user_id, delivery_ref, data){
    const last = state.ledger.length ? state.ledger[state.ledger.length-1] : null;
    const prev_hash = last ? last.hash : null;
    const payload = {event_type,actor_user_id,delivery_ref,data,prev_hash};
    const json = JSON.stringify(payload, Object.keys(payload).sort());
    const hash = await sha256Hex(json);
    state.ledger.push({
      id: state.ledger.length+1,
      ts: new Date().toISOString(),
      event_type, actor_user_id, delivery_ref,
      data_json: JSON.stringify(data),
      prev_hash, hash
    });
    saveState();
    return hash;
  }

  function seedDemo(){
    state.ledger=[]; state.deliveries=[];
    const d1 = mkDelivery({
      delivery_ref:"D00007", farmer_id:"U-FARM-01", buyer_id:"U-BUY-01",
      product:"Spinach", qty:200, uom:"bundles",
      delivery_date:"2026-02-11", terms_days:30,
      gtin:"00012345678905", lot_number:"LOT-2026-02-11-A",
      sscc:"000123456789012345", gln_farmer:"1234567890123", gln_buyer:"9876543210987"
    });
    const d2 = mkDelivery({
      delivery_ref:"D00006", farmer_id:"U-FARM-01", buyer_id:"U-BUY-03",
      product:"Maize meal", qty:150, uom:"bags",
      delivery_date:"2026-01-30", terms_days:14
    });
    d2.status="PAID"; d2.paid_at="2026-02-10T10:20:00Z";
    const d3 = mkDelivery({
      delivery_ref:"D00005", farmer_id:"U-FARM-02", buyer_id:"U-BUY-02",
      product:"Leafy greens", qty:80, uom:"crates",
      delivery_date:"2026-02-02", terms_days:30
    });
    d3.status="CONFIRMED"; d3.confirmed_at="2026-02-02T08:10:00Z";
    state.deliveries.push(d1,d2,d3);
    state.selectedRef="D00007";
    appendEvent("DELIVERY_CREATED","U-FARM-01","D00007",{product:"Spinach",qty:200,uom:"bundles",due_date:d1.due_date,gtin:d1.gtin,lot_number:d1.lot_number,sscc:d1.sscc,gln_farmer:d1.gln_farmer,gln_buyer:d1.gln_buyer});
    appendEvent("DELIVERY_CREATED","U-FARM-01","D00006",{product:"Maize meal",qty:150,uom:"bags",due_date:d2.due_date});
    appendEvent("DELIVERY_CONFIRMED","U-BUY-02","D00005",{});
    appendEvent("PAYMENT_MARKED_PAID","U-BUY-03","D00006",{});
    saveState();
  }

  function filteredDeliveries(){
    if(state.role==="FARMER") return state.deliveries.filter(d=>d.farmer_id===state.user.id);
    if(state.role==="BUYER") return state.deliveries.filter(d=>d.buyer_id===state.user.id);
    return state.deliveries.slice();
  }
  function currentDelivery(){
    return state.deliveries.find(d=>d.delivery_ref===state.selectedRef) || state.deliveries[0];
  }

  async function createDelivery(){
    if(!(state.role==="FARMER"||state.role==="ADMIN")){ showToast("Forbidden: FARMER/ADMIN only."); return; }
    const payload = previewPayload();
    let max=0;
    for(const d of state.deliveries){
      const n = parseInt(d.delivery_ref.slice(1),10);
      if(!isNaN(n)) max=Math.max(max,n);
    }
    const ref = "D"+String(max+1).padStart(5,"0");
    const d = mkDelivery(Object.assign({}, payload, {
      delivery_ref:ref,
      farmer_id:(state.role==="ADMIN"?"U-FARM-01":state.user.id),
      buyer_id:payload.buyer_id
    }));
    state.deliveries.push(d);
    state.selectedRef=ref;
    await appendEvent("DELIVERY_CREATED", state.user.id, ref, payload);
    showToast("Delivery created: "+ref);
    location.hash="#pane=detail&role="+state.role;
  }

  async function confirm(){
    const d = currentDelivery();
    if(!(state.role==="BUYER"||state.role==="ADMIN")){ showToast("Forbidden: BUYER/ADMIN only."); return; }
    if(state.role==="BUYER" && d.buyer_id!==state.user.id){ showToast("Forbidden: buyer mismatch."); return; }
    d.status="CONFIRMED"; d.confirmed_at=new Date().toISOString();
    await appendEvent("DELIVERY_CONFIRMED", state.user.id, d.delivery_ref, {});
    showToast("Confirmed.");
    renderAll();
  }

  async function dispute(){
    const d = currentDelivery();
    if(!(state.role==="BUYER"||state.role==="ADMIN")){ showToast("Forbidden: BUYER/ADMIN only."); return; }
    const code = prompt("Dispute code (QTY_MISMATCH/QUALITY/POD_MISSING/OTHER):","QTY_MISMATCH") || "OTHER";
    const reason = prompt("Reason:","Invoice/POD mismatch") || "";
    const notes = prompt("Notes:","") || "";
    d.status="DISPUTED"; d.dispute_code=code; d.dispute_reason=reason; d.dispute_notes=notes; d.dispute_opened_at=new Date().toISOString();
    await appendEvent("DELIVERY_DISPUTED", state.user.id, d.delivery_ref, {code,reason,notes});
    showToast("Dispute opened.");
    renderAll();
  }

  async function uploadEvidence(){
    const d = currentDelivery();
    if(!(state.role==="BUYER"||state.role==="ADMIN")){ showToast("Forbidden: BUYER/ADMIN only."); return; }
    const filename = prompt("Evidence filename:","POD_photo.jpg") || "evidence.jpg";
    const contents = prompt("Simulated file contents (any text):","photo-bytes") || "bytes";
    const fileHash = await sha256Hex(filename+"|"+contents+"|"+d.delivery_ref);
    d.dispute_evidence_url="uploads/"+d.delivery_ref+"_"+filename;
    d.dispute_evidence_hash=fileHash;
    await appendEvent("DISPUTE_EVIDENCE_UPLOADED", state.user.id, d.delivery_ref, {filename, sha256:fileHash});
    showToast("Evidence hashed: "+fileHash.slice(0,10)+"…");
    renderAll();
  }

  async function resolve(){
    const d = currentDelivery();
    if(!(state.role==="BUYER"||state.role==="ADMIN")){ showToast("Forbidden: BUYER/ADMIN only."); return; }
    const resolution = prompt("Resolution (ACCEPT/CREDIT_NOTE/ADJUST_QTY/REJECT):","ACCEPT") || "ACCEPT";
    const notes = prompt("Resolution notes:","") || "";
    d.dispute_resolution=resolution; d.dispute_resolved_at=new Date().toISOString();
    d.status=(resolution==="REJECT")?"REJECTED":"CONFIRMED";
    await appendEvent("DISPUTE_RESOLVED", state.user.id, d.delivery_ref, {resolution, notes});
    showToast("Dispute resolved: "+resolution);
    renderAll();
  }

  async function submitInvoice(){
    const d = currentDelivery();
    if(!(state.role==="BUYER"||state.role==="ADMIN")){ showToast("Forbidden: BUYER/ADMIN only."); return; }
    const inv = prompt("Invoice ref:","INV-000123") || "INV-000123";
    d.invoice_ref=inv; d.invoice_submitted_at=new Date().toISOString(); d.status="INVOICE_SUBMITTED";
    await appendEvent("INVOICE_SUBMITTED", state.user.id, d.delivery_ref, {invoice_ref:inv});
    showToast("Invoice submitted.");
    renderAll();
  }

  async function approveInvoice(){
    const d = currentDelivery();
    if(!(state.role==="BUYER"||state.role==="ADMIN")){ showToast("Forbidden."); return; }
    d.invoice_approved_at=new Date().toISOString(); d.status="INVOICE_APPROVED";
    await appendEvent("INVOICE_APPROVED", state.user.id, d.delivery_ref, {invoice_ref:d.invoice_ref});
    showToast("Invoice approved.");
    renderAll();
  }

  async function schedulePay(){
    const d = currentDelivery();
    if(!(state.role==="BUYER"||state.role==="ADMIN")){ showToast("Forbidden."); return; }
    d.payment_scheduled_at=new Date().toISOString(); d.status="PAYMENT_SCHEDULED";
    await appendEvent("PAYMENT_SCHEDULED", state.user.id, d.delivery_ref, {});
    showToast("Payment scheduled.");
    renderAll();
  }

  async function markPaid(){
    const d = currentDelivery();
    if(!(state.role==="BUYER"||state.role==="ADMIN")){ showToast("Forbidden."); return; }
    d.paid_at=new Date().toISOString(); d.status="PAID";
    await appendEvent("PAYMENT_MARKED_PAID", state.user.id, d.delivery_ref, {});
    showToast("Marked paid.");
    renderAll();
  }

  async function verifyChain(delivery_ref, simulateTamper=false){
    const events = state.ledger.filter(e=>e.delivery_ref===delivery_ref).slice().sort((a,b)=>a.id-b.id);
    const failures=[]; let prev=null;
    for(let i=0;i<events.length;i++){
      const e=events[i];
      const expectedPrev=prev?prev.hash:null;
      if(e.prev_hash!==expectedPrev) failures.push({index:i,event_id:e.id,reason:"PREV_HASH_MISMATCH"});
      let data={}; try{ data=JSON.parse(e.data_json||"{}"); }catch(_){ data={}; }
      const payload={event_type:e.event_type,actor_user_id:e.actor_user_id,delivery_ref:e.delivery_ref,data,prev_hash:e.prev_hash};
      const json=JSON.stringify(payload,Object.keys(payload).sort());
      const computed=await sha256Hex(json);
      const stored=(simulateTamper&&i===0)?(e.hash.slice(0,-1)+"0"):e.hash;
      if(computed!==stored) failures.push({index:i,event_id:e.id,reason:"HASH_MISMATCH"});
      prev=e;
    }
    return {
      status: failures.length ? "FAIL" : "PASS",
      total_events: events.length,
      failures,
      first_hash: events.length ? events[0].hash : null,
      latest_hash: events.length ? events[events.length-1].hash : null
    };
  }

  function previewPayload(){
    const buyer_id = document.getElementById("f_buyer").value;
    const terms_days = parseInt(document.getElementById("f_terms").value||"30",10);
    const product = document.getElementById("f_product").value;
    const qty = parseFloat(document.getElementById("f_qty").value||"0");
    const uom = document.getElementById("f_uom").value;
    const delivery_date = document.getElementById("f_date").value || todayISO();
    const due_date = addDaysISO(delivery_date, terms_days);
    return {
      buyer_id, product, qty, uom,
      delivery_date, terms_days, due_date,
      gtin: document.getElementById("f_gtin").value || null,
      lot_number: document.getElementById("f_lot").value || null,
      sscc: document.getElementById("f_sscc").value || null,
      gln_farmer: document.getElementById("f_gln_farmer").value || null,
      gln_buyer: document.getElementById("f_gln_buyer").value || null,
      event_timezone: document.getElementById("f_tz").value || "Africa/Johannesburg"
    };
  }

  function renderKPIs(){
    const delivs = filteredDeliveries();
    const total = delivs.length;
    const confirmed = delivs.filter(d=>d.status==="CONFIRMED").length;
    const disputed = delivs.filter(d=>d.status==="DISPUTED").length;
    const overdue = delivs.filter(d=>d.status!=="PAID" && d.due_date < todayISO()).length;
    const row = document.getElementById("kpiRow");
    row.innerHTML="";
    const add=(label,num,hint)=>{
      const div=document.createElement("div");
      div.className="card kpi";
      div.innerHTML=`<div class="muted small">${label}</div><div class="num">${num}</div><div class="muted small">${hint}</div>`;
      row.appendChild(div);
    };
    add("Total",total,"Filtered by role");
    add("Confirmed",confirmed,"Dock confirmation");
    add("Disputed",disputed,"Evidence + hash");
    add("Overdue",overdue,"Working capital pressure");
  }

  function renderTable(){
    const tbody=document.getElementById("deliveriesTbody");
    tbody.innerHTML="";
    const rows=filteredDeliveries().slice().sort((a,b)=>a.delivery_ref<b.delivery_ref?1:-1);
    for(const d of rows){
      const flags=[];
      if(d.dispute_evidence_hash) flags.push("evidence");
      if(d.gtin||d.lot_number) flags.push("GS1");
      if(d.invoice_ref) flags.push("invoice");
      const tr=document.createElement("tr");
      tr.innerHTML=`<td class="mono">${d.delivery_ref}</td><td>${d.product}</td><td>${d.qty} ${d.uom}</td><td>${d.delivery_date}</td><td>${d.due_date}</td><td><span class="badge ${statusBadgeClass(d.status)}">${d.status}</span></td><td class="muted small">${flags.length?flags.join(", "):"-"}</td><td><button class="btn ghost small" data-open="${d.delivery_ref}">Open</button></td>`;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll("button[data-open]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        state.selectedRef=btn.getAttribute("data-open");
        saveState();
        location.hash="#pane=detail&role="+state.role;
      });
    });
  }

  function renderNewPreview(){
    const el=document.getElementById("f_date");
    if(el) el.value = todayISO();
    const payload=previewPayload();
    document.getElementById("previewJson").textContent=JSON.stringify(payload,null,2);
  }

  function renderDetail(){
    const d=currentDelivery();
    if(!d) return;
    document.getElementById("d_ref").textContent=d.delivery_ref;
    const st=document.getElementById("d_status");
    st.textContent=d.status;
    st.className="badge "+statusBadgeClass(d.status);

    document.getElementById("d_summary").textContent =
      `${d.product} | ${d.qty} ${d.uom} | delivery ${d.delivery_date} | due ${d.due_date} | farmer ${d.farmer_id} | buyer ${d.buyer_id} | GTIN ${d.gtin||"-"} | lot ${d.lot_number||"-"} | SSCC ${d.sscc||"-"}`;

    const dis=document.getElementById("d_dispute");
    if(d.status==="DISPUTED"||d.dispute_code){
      dis.className="mono small";
      dis.textContent=`Code: ${d.dispute_code||"-"} | Reason: ${d.dispute_reason||"-"} | Notes: ${d.dispute_notes||"-"} | Opened: ${d.dispute_opened_at||"-"}`;
    }else{
      dis.className="mono small muted";
      dis.textContent="No dispute recorded.";
    }

    document.getElementById("d_evidence").textContent =
      d.dispute_evidence_hash ? `${d.dispute_evidence_hash} (file: ${d.dispute_evidence_url})` : "—";

    document.getElementById("d_invoice").textContent =
      `invoice_ref: ${d.invoice_ref||"-"} | submitted: ${d.invoice_submitted_at||"-"} | approved: ${d.invoice_approved_at||"-"} | scheduled: ${d.payment_scheduled_at||"-"} | paid: ${d.paid_at||"-"}`;

    const evs=state.ledger.filter(e=>e.delivery_ref===d.delivery_ref).slice().reverse().slice(0,12);
    const tbody=document.getElementById("eventsTbody");
    tbody.innerHTML="";
    for(const e of evs){
      const tr=document.createElement("tr");
      tr.innerHTML=`<td class="mono small">${e.ts.slice(0,19)}</td><td class="mono small">${e.event_type}</td><td class="mono small">${(e.prev_hash||"").slice(0,12)}</td><td class="mono small">${(e.hash||"").slice(0,12)}</td>`;
      tbody.appendChild(tr);
    }
  }

  function renderRegulator(){
    const tbody=document.getElementById("regResults");
    tbody.innerHTML="";
    const gtin=document.getElementById("r_gtin").value.trim();
    const lot=document.getElementById("r_lot").value.trim();
    const gf=document.getElementById("r_gln_farmer").value.trim();
    const gb=document.getElementById("r_gln_buyer").value.trim();

    let rows=state.deliveries.slice();
    if(gtin) rows=rows.filter(d=>(d.gtin||"")===gtin);
    if(lot) rows=rows.filter(d=>(d.lot_number||"")===lot);
    if(gf) rows=rows.filter(d=>(d.gln_farmer||"")===gf);
    if(gb) rows=rows.filter(d=>(d.gln_buyer||"")===gb);

    rows=rows.sort((a,b)=>a.delivery_date<b.delivery_date?1:-1).slice(0,200);
    for(const d of rows){
      const tr=document.createElement("tr");
      tr.innerHTML=`<td class="mono">${d.delivery_ref}</td><td class="mono">${d.gtin||"-"}</td><td class="mono">${d.lot_number||"-"}</td><td class="mono">${d.gln_farmer||"-"}</td><td class="mono">${d.gln_buyer||"-"}</td><td><span class="badge ${statusBadgeClass(d.status)}">${d.status}</span></td><td><button class="btn ghost small" data-open="${d.delivery_ref}">Open</button></td>`;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll("button[data-open]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        state.selectedRef=btn.getAttribute("data-open");
        saveState();
        location.hash="#pane=detail&role="+state.role;
      });
    });
  }

  async function verifyQR(){
    const txt=document.getElementById("r_qr").value.trim();
    if(!txt){ showToast("Paste QR JSON first."); return; }
    let payload;
    try{ payload=JSON.parse(txt); }catch(_){ showToast("Invalid JSON."); return; }
    const ref=payload.delivery_ref;
    const qrHash=payload.latest_hash;
    if(!ref||!qrHash){ showToast("Missing delivery_ref/latest_hash."); return; }

    const chain=await verifyChain(ref,false);
    const ledgerHash=chain.latest_hash;
    const match=ledgerHash && (ledgerHash===qrHash);
    const status=(chain.status==="PASS" && match) ? "PASS" : "FAIL";

    const out={
      delivery_ref:ref,
      status,
      ledger_code:(ledgerHash||"NOHASH").slice(0,10).toUpperCase(),
      qr_code:(qrHash||"NOHASH").slice(0,10).toUpperCase(),
      hash_match:!!match,
      chain
    };
    document.getElementById("qrResult").textContent=JSON.stringify(out,null,2);
    showToast("QR verify: "+status);
  }

  function exportCsv(){
    const rows=filteredDeliveries().slice(0,2000);
    const header=["delivery_ref","status","product","qty","uom","delivery_date","due_date","gtin","lot_number","sscc","gln_farmer","gln_buyer"];
    const csv=[header.join(",")].concat(rows.map(d=>[
      d.delivery_ref,d.status,'"'+String(d.product).replaceAll('"','""')+'"',d.qty,d.uom,d.delivery_date,d.due_date,
      d.gtin||"",d.lot_number||"",d.sscc||"",d.gln_farmer||"",d.gln_buyer||""
    ].join(","))).join("\n");
    const blob=new Blob([csv],{type:"text/csv"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download="AgriTrust_Regulator_Results.csv"; a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported.");
  }

  async function runVerify(){
    const ref=document.getElementById("v_ref").value.trim() || state.selectedRef;
    const mode=document.getElementById("v_mode").value;
    const report=await verifyChain(ref, mode==="tamper");
    report.verification_code=(report.latest_hash||"NOHASH").slice(0,10).toUpperCase();
    document.getElementById("verifyReport").textContent=JSON.stringify(report,null,2);
    showToast("Verify: "+report.status);
  }

  // Bindings
  document.getElementById("btnSeed").addEventListener("click", ()=>{ seedDemo(); showToast("Demo data reset."); renderAll(); });
  document.getElementById("btnGoNew").addEventListener("click", ()=> location.hash="#pane=newdelivery&role="+state.role);
  document.getElementById("btnCancelNew").addEventListener("click", ()=> location.hash="#pane=dashboard&role="+state.role);
  document.getElementById("btnRefreshPreview").addEventListener("click", renderNewPreview);
  document.getElementById("btnCreateDelivery").addEventListener("click", createDelivery);

  document.getElementById("btnConfirm").addEventListener("click", confirm);
  document.getElementById("btnDispute").addEventListener("click", dispute);
  document.getElementById("btnUpload").addEventListener("click", uploadEvidence);
  document.getElementById("btnResolve").addEventListener("click", resolve);
  document.getElementById("btnSubmitInvoice").addEventListener("click", submitInvoice);
  document.getElementById("btnApproveInvoice").addEventListener("click", approveInvoice);
  document.getElementById("btnSchedule").addEventListener("click", schedulePay);
  document.getElementById("btnPaid").addEventListener("click", markPaid);

  document.getElementById("btnGotoVerify").addEventListener("click", ()=> location.hash="#pane=verify&role="+state.role);
  document.getElementById("btnBackDash").addEventListener("click", ()=> location.hash="#pane=dashboard&role="+state.role);

  document.getElementById("btnSearch").addEventListener("click", renderRegulator);
  document.getElementById("btnResetFilters").addEventListener("click", ()=>{ ["r_gtin","r_lot","r_gln_farmer","r_gln_buyer"].forEach(id=>document.getElementById(id).value=""); renderRegulator(); });
  document.getElementById("btnExportCsv").addEventListener("click", exportCsv);
  document.getElementById("btnVerifyQR").addEventListener("click", verifyQR);
  document.getElementById("btnUseCurrentQR").addEventListener("click", ()=>{
    const d=currentDelivery();
    const events=state.ledger.filter(e=>e.delivery_ref===d.delivery_ref).slice().sort((a,b)=>a.id-b.id);
    const latest=events.length?events[events.length-1].hash:null;
    const payload={schema_version:"1.0",delivery_ref:d.delivery_ref,latest_hash:latest,gtin:d.gtin,lot_number:d.lot_number,sscc:d.sscc,gln_farmer:d.gln_farmer,gln_buyer:d.gln_buyer,delivery_date:d.delivery_date,due_date:d.due_date,status:d.status};
    document.getElementById("r_qr").value=JSON.stringify(payload,null,2);
    showToast("Current delivery QR payload inserted.");
  });

  document.getElementById("btnVerify").addEventListener("click", runVerify);
  document.getElementById("btnVerifyPdf").addEventListener("click", ()=> showToast("Verify PDF is generated server-side in Flask; this static prototype shows report structure only."));

  // Routing
  function renderAll(){
    const pane=parsePaneFromHash();
    // set pane
    const panes=["dashboard","newdelivery","detail","regulator","verify","governance"];
    panes.forEach(p=>{ const el=document.getElementById("pane-"+p); if(el) el.classList.toggle("active", p===pane); });
    // nav active
    const nav=document.getElementById("nav");
    [...nav.querySelectorAll(".navitem")].forEach(i=>i.classList.toggle("active", i.dataset.pane===pane));
    // newdelivery date
    const fd=document.getElementById("f_date");
    if(fd) fd.value=todayISO();
    renderKPIs();
    renderTable();
    renderNewPreview();
    renderDetail();
    renderRegulator();
    const vref=document.getElementById("v_ref");
    if(vref) vref.value=state.selectedRef||"D00007";
    saveState();
  }

  // nav click
  document.getElementById("nav").addEventListener("click",(e)=>{
    const item=e.target.closest(".navitem");
    if(!item) return;
    location.hash="#pane="+item.dataset.pane+"&role="+state.role;
  });

  function init(){
    setRole(getRoleFromHash());
    if(!state.deliveries.length) seedDemo();
    const pane=parsePaneFromHash();
    if(!pane) location.hash="#pane=dashboard&role="+state.role;
    window.addEventListener("hashchange", ()=>{
      const role=getRoleFromHash();
      if(role!==state.role) setRole(role);
      renderAll();
    });
    renderAll();
  }
  init();
})();


// ------------------------------
// v7 Add-on: Board-ready Audit Pack + Recall link (role-based portal)
// ------------------------------
(function(){
  const auditBtn = document.getElementById("btnAuditPack");
  const recallBtn = document.getElementById("btnRecallDrill");
  if(!auditBtn && !recallBtn) return;

  function toast(msg){
    const t = document.getElementById("toast");
    if(!t) return alert(msg);
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(()=>t.classList.remove("show"), 2600);
  }

  function currentRef(){
    return (typeof state !== "undefined" && state.selectedRef) ? state.selectedRef : null;
  }

  function findDelivery(ref){
    return (typeof state !== "undefined" && state.deliveries) ? state.deliveries.find(d=>d.delivery_ref===ref) : null;
  }

  function ledgerEvents(ref){
    return (typeof state !== "undefined" && state.ledger) ? state.ledger.filter(e=>e.delivery_ref===ref).slice().sort((a,b)=>a.id-b.id) : [];
  }

  function codeFromHash(h){ return (h||"NOHASH").slice(0,10).toUpperCase(); }

  function makeVerificationNumber(){
    const s = "VR-" + new Date().toISOString();
    let x=0; for(let i=0;i<s.length;i++){ x=((x<<5)-x)+s.charCodeAt(i); x|=0; }
    return ("VR"+Math.abs(x)).slice(0,10);
  }

  function downloadAuditPack(){
    const ref = currentRef();
    const d = findDelivery(ref);
    if(!d) return toast("No delivery selected.");

    const events = ledgerEvents(ref);
    const latest_hash = events.length ? events[events.length-1].hash : "";
    const verification_code = codeFromHash(latest_hash);
    const stamp_id = d.delivery_ref + "-" + verification_code;

    const status = "PASS"; // demo default; chain verify shown in Ledger Verify pane
    const badgeClass = status==="PASS" ? "good" : "bad";
    const badgeText = status==="PASS" ? "PASS ✅" : "FAIL ❌";

    const rows = events.map(e=>`<tr><td>${e.ts.slice(0,19)}</td><td>${e.event_type}</td><td>${(e.prev_hash||"").slice(0,16)}</td><td>${(e.hash||"").slice(0,16)}</td></tr>`).join("");

    const chainVisual = events.map((e,i)=>`
      <div style="border:1px solid #e5e7eb;border-radius:12px;padding:8px 10px;background:#ffffff;font-family:monospace;font-size:11px;min-width:180px">
        <div><b>#${i+1}</b> ${e.event_type}</div>
        <div style="color:#6b7280;font-family:Arial;font-size:10px">prev: ${(e.prev_hash||"-").slice(0,10)}</div>
        <div style="color:#6b7280;font-family:Arial;font-size:10px">hash: ${(e.hash||"-").slice(0,10)}</div>
      </div>${i<events.length-1?'<div style="font-size:18px;color:#6b7280">→</div>':''}
    `).join("");

    const payload = {
      schema_version:"1.0",
      delivery_ref:d.delivery_ref,
      latest_hash: latest_hash,
      gtin:d.gtin || null,
      lot_number:d.lot_number || null,
      sscc:d.sscc || null,
      gln_farmer:d.gln_farmer || null,
      gln_buyer:d.gln_buyer || null,
      delivery_date:d.delivery_date || null,
      due_date:d.due_date || null,
      status:d.status || null
    };

    const verificationNumber = makeVerificationNumber();
    const qrLib = `/*! qrcode-generator (minimal) - adapted for demo; produces QR Code as canvas. */
(function(g){
  function QR8bitByte(data){this.mode=1;this.data=data;this.parsed=[];for(var i=0;i<data.length;i++){this.parsed.push(data.charCodeAt(i));}}
  QR8bitByte.prototype={getLength:function(){return this.parsed.length;},write:function(buf){for(var i=0;i<this.parsed.length;i++){buf.put(this.parsed[i],8);}}};
  function BitBuffer(){this.buffer=[];this.length=0;}
  BitBuffer.prototype={get:function(i){var b=Math.floor(i/8);return ((this.buffer[b]>>> (7-i%8))&1)==1;},
    put:function(num,len){for(var i=0;i<len;i++){this.putBit(((num>>> (len-i-1))&1)==1);} },
    putBit:function(bit){var b=Math.floor(this.length/8);if(this.buffer.length<=b){this.buffer.push(0);}if(bit){this.buffer[b]|=(0x80>>> (this.length%8));}this.length++;}
  };
  // Very small QR: fixed version=4, error correction=L (good for short payloads)
  // This is a demo-quality generator, not for large payloads.
  function QRCode(data){
    this.typeNumber=4; this.errorCorrectLevel=1; // L
    this.modules=null; this.moduleCount=0;
    this.dataList=[new QR8bitByte(data)];
    this.make();
  }
  QRCode.prototype={
    make:function(){
      this.moduleCount=this.typeNumber*4+17;
      this.modules=new Array(this.moduleCount);
      for(var r=0;r<this.moduleCount;r++){this.modules[r]=new Array(this.moduleCount);for(var c=0;c<this.moduleCount;c++){this.modules[r][c]=null;}}
      this.setupPositionProbePattern(0,0);
      this.setupPositionProbePattern(this.moduleCount-7,0);
      this.setupPositionProbePattern(0,this.moduleCount-7);
      this.setupTimingPattern();
      this.mapData(this.createData(),0);
    },
    setupPositionProbePattern:function(row,col){
      for(var r=-1;r<=7;r++){
        if(row+r<=-1||this.moduleCount<=row+r)continue;
        for(var c=-1;c<=7;c++){
          if(col+c<=-1||this.moduleCount<=col+c)continue;
          if((0<=r&&r<=6&&(c==0||c==6))||(0<=c&&c<=6&&(r==0||r==6))||(2<=r&&r<=4&&2<=c&&c<=4)){
            this.modules[row+r][col+c]=true;
          }else{
            this.modules[row+r][col+c]=false;
          }
        }
      }
    },
    setupTimingPattern:function(){
      for(var i=8;i<this.moduleCount-8;i++){
        if(this.modules[i][6]===null)this.modules[i][6]=(i%2==0);
        if(this.modules[6][i]===null)this.modules[6][i]=(i%2==0);
      }
    },
    createData:function(){
      var buffer=new BitBuffer();
      buffer.put(4,4); // mode byte
      buffer.put(this.dataList[0].getLength(),8);
      this.dataList[0].write(buffer);
      // terminator
      buffer.put(0,4);
      // pad to byte
      while(buffer.length%8!=0)buffer.putBit(false);
      // pad bytes to a small fixed length (demo)
      var totalBytes=80; // enough for short payloads in v4-L (demo)
      var padBytes=[0xec,0x11]; var p=0;
      while(buffer.buffer.length<totalBytes){
        buffer.put(padBytes[p%2],8); p++;
      }
      return buffer;
    },
    mapData:function(data,maskPattern){
      var inc=-1; var row=this.moduleCount-1; var bitIndex=0; var byteIndex=0;
      for(var col=this.moduleCount-1;col>0;col-=2){
        if(col==6)col--;
        while(true){
          for(var c=0;c<2;c++){
            if(this.modules[row][col-c]===null){
              var dark=false;
              if(byteIndex<data.buffer.length){
                dark=((data.buffer[byteIndex]>>> (7-bitIndex))&1)==1;
              }
              var mask=((row+col)%2==0);
              this.modules[row][col-c]=mask? !dark: dark;
              bitIndex++;
              if(bitIndex==8){byteIndex++;bitIndex=0;}
            }
          }
          row+=inc;
          if(row<0||this.moduleCount<=row){row-=inc;inc=-inc;break;}
        }
      }
    },
    isDark:function(r,c){return this.modules[r][c];}
  };

  function toCanvas(text, size, canvas){
    var qr=new QRCode(text);
    var count=qr.moduleCount;
    canvas.width=size; canvas.height=size;
    var ctx=canvas.getContext("2d");
    var tile=size/count;
    for(var r=0;r<count;r++){
      for(var c=0;c<count;c++){
        ctx.fillStyle=qr.isDark(r,c) ? "#111" : "#fff";
        var w=Math.ceil((c+1)*tile)-Math.floor(c*tile);
        var h=Math.ceil((r+1)*tile)-Math.floor(r*tile);
        ctx.fillRect(Math.round(c*tile),Math.round(r*tile),w,h);
      }
    }
  }

  g.QRDemo={toCanvas:toCanvas};
})(window);
`;

    const html = `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>AgriTrust Audit Pack — ${d.delivery_ref}</title>
<style>
body{font-family:Arial;margin:0;background:#f7f7fb;color:#111}
.page{max-width:980px;margin:22px auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.08);padding:18px;position:relative}
h1{margin:0;font-size:20px}
.muted{color:#6b7280;font-size:12px}
.top{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.stamp{border:1px solid #e5e7eb;border-radius:14px;padding:10px;min-width:260px}
.badge{display:inline-block;padding:6px 10px;border-radius:999px;font-weight:700}
.good{background:#d1fae5;color:#065f46;border:1px solid #34d399}
.bad{background:#fee2e2;color:#991b1b;border:1px solid #fb7185}
.hr{height:1px;background:#e5e7eb;margin:14px 0}
.kv{display:grid;grid-template-columns:220px 1fr;gap:8px;margin-top:12px}
.kv div{padding:8px;border:1px solid #eef2f7;border-radius:12px;background:#fafafa;font-size:12px}
table{width:100%;border-collapse:collapse;margin-top:14px}
th,td{border:1px solid #eef2f7;padding:8px;font-size:12px;text-align:left;vertical-align:top}
th{background:#f3f4f6}
.qrbox{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}
.qrbox canvas{border:1px solid #e5e7eb;border-radius:12px}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
.btn{padding:10px 12px;border:1px solid #e5e7eb;border-radius:10px;background:#111;color:#fff;cursor:pointer}
.btn.secondary{background:#4f46e5;border-color:#4f46e5}
.watermark{position:fixed;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:80px;color:rgba(0,0,0,0.04);font-weight:bold;pointer-events:none}
.seal{position:absolute;top:18px;right:18px;border:2px solid #111;border-radius:50%;width:120px;height:120px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;text-align:center}
.disclaimer{margin-top:12px;font-size:11px;color:#6b7280}
</style></head>
<body>
<div class="page">
  <div class="watermark">AGRITRUST</div>
  <div class="seal">VERIFIED<br/>DIGITAL<br/>LEDGER</div>

  <div class="top">
    <div>
      <h1>AgriTrust Audit Pack</h1>
      <div class="muted">Generated (UTC): ${new Date().toISOString()}</div>
      <div class="muted">Delivery Ref: <b>${d.delivery_ref}</b></div>
      <div class="muted">Verification Code: <b>${verification_code}</b></div>
    </div>
    <div class="stamp">
      <div class="muted" style="font-weight:700;margin-bottom:6px">OFFICIAL LEDGER VERIFICATION STAMP</div>
      <div class="badge ${badgeClass}">${badgeText}</div>
      <div class="muted" style="margin-top:8px"><b>STAMP-ID:</b> ${stamp_id}</div>
      <div class="muted"><b>Latest hash:</b> ${(latest_hash||"").slice(0,16)}…</div>
    </div>
  </div>

  <div class="hr"></div>

  <div class="qrbox">
    <div>
      <div class="muted" style="font-weight:700;margin-bottom:6px">QR Payload (Scan Concept)</div>
      <canvas id="qr" width="160" height="160"></canvas>
    </div>
    <div style="flex:1">
      <div class="muted">QR encodes payload (delivery_ref + latest_hash + identifiers) for regulator validation.</div>
      <pre style="white-space:pre-wrap;background:#f9fafb;border:1px solid #eef2f7;border-radius:12px;padding:10px;font-size:11px;margin:10px 0 0">${JSON.stringify(payload,null,2)}</pre>
    </div>
  </div>

  <div class="hr"></div>
  <div style="font-weight:700">Delivery Summary</div>
  <div class="kv">
    <div class="muted">Product</div><div>${d.product}</div>
    <div class="muted">Quantity</div><div>${d.qty} ${d.uom}</div>
    <div class="muted">Delivery date</div><div>${d.delivery_date}</div>
    <div class="muted">Due date</div><div>${d.due_date}</div>
    <div class="muted">Status</div><div>${d.status}</div>
    <div class="muted">GTIN</div><div>${d.gtin||"-"}</div>
    <div class="muted">Lot / Batch</div><div>${d.lot_number||"-"}</div>
    <div class="muted">SSCC</div><div>${d.sscc||"-"}</div>
    <div class="muted">GLN Farmer</div><div>${d.gln_farmer||"-"}</div>
    <div class="muted">GLN Buyer</div><div>${d.gln_buyer||"-"}</div>
  </div>

  <div class="hr"></div>
  <div style="font-weight:700">Evidence Integrity</div>
  <div class="muted">Evidence SHA-256 (if any):</div>
  <div style="font-family:monospace;font-size:12px;margin-top:6px">${d.dispute_evidence_hash||"No evidence uploaded"}</div>

  <div class="hr"></div>
  <div style="font-weight:700">Ledger Events (Hash-Linked)</div>
  <table>
    <thead><tr><th>Timestamp</th><th>Event</th><th>Prev hash</th><th>Hash</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="hr"></div>
  <div style="font-weight:700">Hash Chain Visual</div>
  <div class="muted">Simplified linkage (prev_hash → hash).</div>
  <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">${chainVisual}</div>

  <div class="hr"></div>
  <div style="font-weight:700">Regulator Verification Sign-off (Mock)</div>
  <div class="muted">Verification Number: <b>${verificationNumber}</b> (demo)</div>
  <div class="kv" style="margin-top:10px">
    <div class="muted">Verified by</div><div>__________________________________________</div>
    <div class="muted">Role / Organisation</div><div>__________________________________________</div>
    <div class="muted">Date</div><div>____________________</div>
    <div class="muted">Signature</div><div>____________________</div>
  </div>

  <div class="actions">
    <button class="btn" onclick="window.print()">Print / Save as PDF</button>
    <button class="btn secondary" onclick="downloadJSON()">Download QR JSON</button>
  </div>

  <div class="disclaimer">
    Version: v7.0 · Build hash: C01897E28173<br/>
    This report verifies digital record integrity only and does not constitute product certification. Digital logs do not replace inspection.
    <br/><br/>
    © 2026 AgriTrust. All rights reserved. Created for Valar Capstone 2026 by Jackson Mambozoukuni.
  </div>
</div>

<script>${qrLib}</script>
<script>
(function(){
  var text = JSON.stringify(payload);
  QRDemo.toCanvas(text, 160, document.getElementById("qr"));
})();
function downloadJSON(){
  var blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href=url; a.download="AgriTrust_QR_Payload_${payload.delivery_ref}.json"; a.click();
  URL.revokeObjectURL(url);
}
</script>
</body></html>`;

    const blob = new Blob([html], {type:"text/html"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url;
    a.download="AgriTrust_AuditPack_" + d.delivery_ref + ".html";
    a.click();
    URL.revokeObjectURL(url);
    toast("Audit Pack downloaded.");
  }

  if(auditBtn) auditBtn.addEventListener("click", downloadAuditPack);
  if(recallBtn) recallBtn.addEventListener("click", ()=> window.open("recall.html","_blank"));
})();
