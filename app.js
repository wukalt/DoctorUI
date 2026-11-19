(() => {
  const API = (window.APP_CONFIG?.API_BASE_URL || "https://backend-b2dfba7d.fastapicloud.dev").replace(/\/$/, "");
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const toast = message => { const el=$("#toast"); if(!el)return; el.textContent=message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove("show"),3200); };
  async function request(path, options={}) {
    const response = await fetch(API + path, { ...options, headers: { ...(options.body ? {"Content-Type":"application/json"} : {}), ...(options.headers||{}) } });
    if(response.status===204) return null;
    const raw=await response.text(); let data=null; try{data=raw?JSON.parse(raw):null}catch{data=raw}
    if(!response.ok) { const detail=data?.detail; throw new Error(Array.isArray(detail)?detail.map(x=>x.msg).join("، "):(typeof detail==="string"?detail:(data?.message||`خطای سرور (${response.status})`))); }
    return data;
  }
  const fmt = value => esc(value || "—");
  const slotsOf = doctor => Array.isArray(doctor.schedule)?doctor.schedule:[];
  const slotLabel = slot => `${slot.start || "—"}${slot.end ? " تا "+slot.end : ""}`;
  const available = slot => !slot.is_reserved && !slot.reserved_by;
  const modalOpen = id => $(id)?.classList.remove("hidden");
  const modalClose = el => el?.classList.add("hidden");
  $$("[data-close]").forEach(el=>el.addEventListener("click",()=>modalClose(el.closest(".modal"))));

  // صفحه کاربران
  if($("#doctor-grid")) {
    let doctors=[];
    const grid=$("#doctor-grid"), search=$("#search");
    function renderDoctors(){
      const term=(search.value||"").trim().toLowerCase();
      const filtered=doctors.filter(d=>`${d.name||""} ${d.description||""} ${d.address||""}`.toLowerCase().includes(term));
      $("#doctor-count").textContent=doctors.length.toLocaleString("fa-IR");
      grid.innerHTML=filtered.map(d=>{
        const slots=slotsOf(d), free=slots.filter(available).length;
        return `<article class="doctor-card"><div class="doctor-card-top"><div class="doctor-avatar">${esc((d.name||"پ").trim().charAt(0))}</div><span class="availability ${free?"":"none"}">${free?`${free.toLocaleString("fa-IR")} زمان آزاد`:"زمان آزاد ندارد"}</span></div><h3>${fmt(d.name)}</h3><p class="doctor-desc">${fmt(d.description||"اطلاعاتی ثبت نشده است.")}</p><div class="doctor-meta"><span>⌖</span><span>${fmt(d.address)}</span></div><div class="doctor-meta"><span>☎</span><span dir="ltr">${fmt(d.phone_number)}</span></div><div class="slot-list">${slots.length?slots.map(s=>`<span class="slot-chip ${available(s)?"":"booked"}">${fmt(slotLabel(s))}${available(s)?"":" · رزرو"}</span>`).join(""):'<small>برنامه زمانی ثبت نشده است.</small>'}</div><button class="primary-btn full book-doctor" data-id="${d.id}" ${free?"":"disabled"}>${free?"انتخاب زمان و رزرو":"فعلاً نوبت موجود نیست"} <span>←</span></button></article>`;
      }).join("") || "";
      $("#empty-state").classList.toggle("hidden",filtered.length>0);
      $$(".book-doctor",grid).forEach(btn=>btn.addEventListener("click",()=>openBooking(Number(btn.dataset.id))));
    }
    async function loadDoctors(){grid.innerHTML='<div class="loading">در حال دریافت فهرست پزشکان...</div>';try{doctors=await request("/doctors")||[];renderDoctors()}catch(e){grid.innerHTML=`<div class="error-state">دریافت اطلاعات ناموفق بود: ${esc(e.message)}<br><small>آدرس API و فعال بودن سرور را بررسی کن.</small></div>`}}
    search.addEventListener("input",renderDoctors);
    function openBooking(id){
      const d=doctors.find(x=>Number(x.id)===id); if(!d)return;
      const slots=slotsOf(d).filter(available);
      $("#modal-title").textContent=`رزرو نوبت ${d.name}`;
      $("#modal-subtitle").textContent=d.address||"";
      $("#booking-doctor-id").value=id;
      $("#booking-start").value="";
      $("#selected-slot").innerHTML=`<label>زمان مراجعه<select id="slot-choice" required><option value="">یک زمان آزاد انتخاب کن</option>${slots.map(s=>`<option value="${esc(s.start)}">${esc(slotLabel(s))}</option>`).join("")}</select></label>`;
      $("#slot-choice").addEventListener("change",e=>$("#booking-start").value=e.target.value);
      $("#patient-name").value="";
      modalOpen("#booking-modal");
    }
    $("#booking-form").addEventListener("submit",async e=>{
      e.preventDefault(); const id=$("#booking-doctor-id").value, name=$("#patient-name").value.trim(), start=$("#booking-start").value;
      if(!start)return toast("لطفاً یک زمان آزاد انتخاب کن.");
      try{await request(`/doctors/${id}/reserve`,{method:"POST",body:JSON.stringify({name,start})});toast("درخواست رزرو با موفقیت ثبت شد.");modalClose($("#booking-modal"));await loadDoctors()}
      catch(err){toast(`ثبت رزرو انجام نشد: ${err.message}`)}
    });
    loadDoctors();
  }

  // صفحه مدیریت
  if($("#admin-doctors")) {
    let doctors=[];
    const list=$("#admin-doctors");
    function updateStats(){
      const slots=doctors.flatMap(slotsOf);
      $("#stat-doctors").textContent=doctors.length.toLocaleString("fa-IR");
      $("#stat-slots").textContent=slots.length.toLocaleString("fa-IR");
      $("#stat-reserved").textContent=slots.filter(s=>!available(s)).length.toLocaleString("fa-IR");
    }
    function renderAdmin(){
      updateStats();
      list.innerHTML=doctors.map(d=>`<article class="admin-doctor"><div class="doctor-avatar small-avatar">${esc((d.name||"پ").trim().charAt(0))}</div><div class="admin-doctor-info"><b>${fmt(d.name)}</b><span>${fmt(d.phone_number)} · ${fmt(d.address)}</span><small>${slotsOf(d).length.toLocaleString("fa-IR")} زمان ثبت‌شده، ${slotsOf(d).filter(available).length.toLocaleString("fa-IR")} آزاد</small></div><div class="admin-actions"><button class="icon-btn edit-btn" data-id="${d.id}" title="ویرایش">✎</button><button class="icon-btn delete-btn" data-id="${d.id}" title="حذف">⌫</button></div></article>`).join("")||'<div class="empty-state">هنوز پزشکی ثبت نشده است. از «افزودن پزشک» شروع کن.</div>';
      $$(".edit-btn",list).forEach(b=>b.addEventListener("click",()=>editDoctor(Number(b.dataset.id))));
      $$(".delete-btn",list).forEach(b=>b.addEventListener("click",()=>deleteDoctor(Number(b.dataset.id))));
    }
    async function loadDoctors(){list.innerHTML='<div class="loading">در حال بارگذاری...</div>';try{doctors=await request("/doctors")||[];renderAdmin()}catch(e){list.innerHTML=`<div class="error-state">خطا در دریافت پزشکان: ${esc(e.message)}</div>`}}
    $("#refresh").addEventListener("click",loadDoctors);
    function addSlot(slot={}) {
      const row=document.createElement("div"); row.className="schedule-row";
      row.innerHTML=`<label>شروع<input class="slot-start" type="text" placeholder="09:00" value="${esc(slot.start||"")}"></label><label>پایان<input class="slot-end" type="text" placeholder="09:30" value="${esc(slot.end||"")}"></label><button type="button" class="remove-slot" title="حذف زمان">×</button>`;
      $(".remove-slot",row).addEventListener("click",()=>row.remove()); $("#schedule-editor").append(row);
    }
    function resetForm(){ $("#doctor-form").reset();$("#edit-id").value="";$("#schedule-editor").innerHTML="";$("#doctor-modal-title").textContent="افزودن پزشک جدید";$("#form-eyebrow").textContent="ثبت اطلاعات"; }
    $("#open-create").addEventListener("click",()=>{resetForm();modalOpen("#doctor-modal")});
    $("#add-slot").addEventListener("click",()=>addSlot());
    function editDoctor(id){
      const d=doctors.find(x=>Number(x.id)===id);if(!d)return;
      resetForm();$("#edit-id").value=id;$("#doctor-modal-title").textContent="ویرایش اطلاعات پزشک";$("#form-eyebrow").textContent="ویرایش";
      $("#doctor-name").value=d.name||"";$("#doctor-phone").value=d.phone_number||"";$("#doctor-address").value=d.address||"";$("#doctor-description").value=d.description||"";
      slotsOf(d).forEach(s=>addSlot(s));modalOpen("#doctor-modal");
    }
    async function deleteDoctor(id){
      const d=doctors.find(x=>Number(x.id)===id);if(!confirm(`پزشک «${d?.name||""}» حذف شود؟`))return;
      try{await request(`/doctors/${id}/delete`,{method:"DELETE"});toast("پزشک حذف شد.");await loadDoctors()}catch(e){toast(`حذف ناموفق بود: ${e.message}`)}
    }
    $("#doctor-form").addEventListener("submit",async e=>{
      e.preventDefault();
      const schedule=$$(".schedule-row",$("#schedule-editor")).map(row=>({start:$(".slot-start",row).value.trim(),end:$(".slot-end",row).value.trim(),is_reserved:false,reserved_by:null})).filter(s=>s.start&&s.end);
      const payload={name:$("#doctor-name").value.trim(),phone_number:$("#doctor-phone").value.trim(),address:$("#doctor-address").value.trim(),description:$("#doctor-description").value.trim(),schedule};
      const id=$("#edit-id").value;
      try{
        if(id){await request(`/doctors/${id}/update`,{method:"PATCH",body:JSON.stringify({name:payload.name,phone_number:payload.phone_number,address:payload.address,description:payload.description})});}
        else await request("/create",{method:"POST",body:JSON.stringify(payload)});
        toast(id?"اطلاعات پزشک بروزرسانی شد.":"پزشک جدید ثبت شد.");modalClose($("#doctor-modal"));await loadDoctors();
      }catch(err){toast(`ذخیره انجام نشد: ${err.message}`)}
    });
    $("#ai-form").addEventListener("submit",async e=>{
      e.preventDefault();const btn=$("button[type=submit]",e.currentTarget), question=$("#ai-question").value.trim();if(!question)return;
      btn.disabled=true;btn.textContent="در حال دریافت...";
      try{const result=await request("/ask_ai",{method:"POST",body:JSON.stringify(question)});$("#ai-answer").textContent=typeof result==="string"?result:JSON.stringify(result,null,2);$("#ai-answer").classList.remove("hidden")}
      catch(err){toast(`خطا در ارتباط با AI: ${err.message}`)}
      finally{btn.disabled=false;btn.textContent="ارسال پرسش ←"}
    });
    loadDoctors();
  }
})();