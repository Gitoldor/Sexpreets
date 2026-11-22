(() => {
 const API="https://sexpreets-post-api.sho1re1.workers.dev";
 const form=document.getElementById("post-form"),submit=document.getElementById("submit-button"),panel=document.getElementById("payment-panel"),code=document.getElementById("post-code"),message=document.getElementById("payment-message"),checkout=document.getElementById("checkout-button"),publishStatus=document.getElementById("publish-status");
 let active=null,sending=false,pollTimer=null,pollStarted=0,pollBusy=false;
 const showMessage=t=>{panel.hidden=false;message.textContent=t;};
 const makeCode=()=>"SHO-"+crypto.randomUUID().replace(/-/g,"").slice(0,10).toUpperCase();
 function readPost(){
  const post=Object.fromEntries(new FormData(form).entries());post.lat=Number(post.lat);post.lng=Number(post.lng);
  if(!Number.isFinite(post.lat)||post.lat< -90||post.lat>90||!Number.isFinite(post.lng)||post.lng< -180||post.lng>180)throw new Error("Please enter valid map coordinates.");
  return post;
 }
 async function api(path,options={}){
  const key=sessionStorage.getItem("famgateway_api_key")||"";
  const response=await fetch(API+path,{...options,headers:{"Accept":"application/json",...(options.body?{"Content-Type":"application/json"}:{}),...(key?{"X-FamGateway-Api-Key":key}:{}),...(options.headers||{})},cache:"no-store"});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.ok===false)throw new Error(result.error||result.message||"Cloudflare API error ("+response.status+").");
  return result;
 }
 function stopPolling(){if(pollTimer){clearInterval(pollTimer);pollTimer=null;}}
 async function publishVerifiedPayment(payment){
  if(!active||sending)return;
  if(payment.order_id!==active.gatewayOrderId||Number(payment.amount)!==1||!/^\d{12}$/.test(String(payment.utr||"")))throw new Error("Payment details did not match this checkout.");
  sending=true;stopPolling();message.textContent="Payment verified by FamGateway. Publishing your post…";
  try{
   const result=await api("/api/posts",{method:"POST",body:JSON.stringify({post:active.post,post_code:active.postCode,gateway_order_id:active.gatewayOrderId})});
   if(!result.published)throw new Error("The database did not confirm publication.");
   message.textContent="Payment verified and your post is now published.";
   publishStatus.textContent="Published · "+result.post_code+" · UTR "+result.utr;
   checkout.hidden=true;active=null;form.reset();
  }catch(error){
   message.textContent=error.message;
   if(/already been used/i.test(error.message)){active=null;checkout.hidden=true;}
   else{pollTimer=setInterval(checkPayment,3000);}
  }finally{sending=false;}
 }
 async function checkPayment(){
  if(!active||sending||pollBusy)return;
  if(Date.now()-pollStarted>5*60*1000){stopPolling();message.textContent="This payment session has expired. Create a fresh payment to try again.";return;}
  pollBusy=true;
  try{
   const result=await api("/api/verify-order?order_id="+encodeURIComponent(active.gatewayOrderId));
   if(result.paid){await publishVerifiedPayment(result);return;}
   if(result.status==="expired"){stopPolling();message.textContent="FamGateway reports that this payment session expired. Create a new payment to continue.";return;}
   message.textContent="Waiting for FamGateway to confirm your ₹1 payment…";
  }catch(error){
   message.textContent="Checking payment… "+error.message;
  }finally{pollBusy=false;}
 }
 form.addEventListener("submit",async event=>{
  event.preventDefault();if(!form.reportValidity())return;
  stopPolling();submit.disabled=true;submit.textContent="Preparing payment…";
  try{
   const post=readPost(),postCode=makeCode();
   const order=await api("/api/orders",{method:"POST",body:JSON.stringify({post,post_code:postCode})});
   if(!order.upi_intent||!String(order.upi_intent).startsWith("upi://pay?"))throw new Error("FamGateway did not return a valid UPI payment link.");
   active={post,postCode,gatewayOrderId:order.gateway_order_id};
   code.textContent=postCode;checkout.href=order.upi_intent;checkout.hidden=false;
   panel.hidden=false;message.textContent="Open your UPI app and pay ₹1. This page will automatically check with FamGateway and publish only after the payment is verified.";
   publishStatus.textContent="No post or order has been written to D1. Waiting for verified payment.";
   pollStarted=Date.now();pollTimer=setInterval(checkPayment,3000);setTimeout(checkPayment,800);
   panel.scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){showMessage(error.message);}
  finally{submit.disabled=false;submit.innerHTML='Create ₹1 payment <span>↗</span>';}
 });
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)checkPayment();});
 window.addEventListener("focus",checkPayment);
 document.getElementById("copy-code").addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText(code.textContent);document.getElementById("copy-code").textContent="Copied";}
  catch(_){showMessage("Select and copy the post code manually.");}
 });
 document.getElementById("locate").addEventListener("click",()=>{
  const button=document.getElementById("locate");if(!navigator.geolocation){showMessage("Location is not supported by this browser.");return;}
  button.disabled=true;button.textContent="Finding location…";
  navigator.geolocation.getCurrentPosition(position=>{form.elements.lat.value=position.coords.latitude.toFixed(6);form.elements.lng.value=position.coords.longitude.toFixed(6);button.disabled=false;button.textContent="Location added";},error=>{button.disabled=false;button.textContent="Use my current location";showMessage(error.message);},{enableHighAccuracy:true,timeout:12000});
 });
})();