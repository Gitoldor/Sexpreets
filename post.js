(() => {
 const API="https://sexpreets-post-api.sho1re1.workers.dev";
 const form=document.getElementById("post-form"),submit=document.getElementById("submit-button"),panel=document.getElementById("payment-panel"),code=document.getElementById("post-code"),message=document.getElementById("payment-message"),checkout=document.getElementById("checkout-button"),publish=document.getElementById("publish-button"),publishStatus=document.getElementById("publish-status");
 let active=null,sending=false;
 const showMessage=t=>{panel.hidden=false;message.textContent=t;};
 const makeCode=()=>"SHO-"+crypto.randomUUID().replace(/-/g,"").slice(0,10).toUpperCase();
 function readPost(){
  const post=Object.fromEntries(new FormData(form).entries());post.lat=Number(post.lat);post.lng=Number(post.lng);
  if(!Number.isFinite(post.lat)||post.lat< -90||post.lat>90||!Number.isFinite(post.lng)||post.lng< -180||post.lng>180)throw new Error("Please enter valid map coordinates.");
  return post;
 }
 async function api(path,options={}){
  const key=sessionStorage.getItem("famgateway_api_key")||"";
  const response=await fetch(API+path,{...options,headers:{"Accept":"application/json",...(options.body?{"Content-Type":"application/json"}:{}),...(path==="/api/orders"&&key?{"X-FamGateway-Api-Key":key}:{}),...(options.headers||{})},cache:"no-store"});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.ok===false)throw new Error(result.error||result.message||"Cloudflare API error ("+response.status+").");
  return result;
 }
 form.addEventListener("submit",async event=>{
  event.preventDefault();if(!form.reportValidity())return;
  submit.disabled=true;submit.textContent="Preparing payment…";
  try{
   const post=readPost(),postCode=makeCode();
   const order=await api("/api/orders",{method:"POST",body:JSON.stringify({post,post_code:postCode})});
   if(!order.upi_intent||!String(order.upi_intent).startsWith("upi://pay?"))throw new Error("FamGateway did not return a valid UPI payment link.");
   active={post,postCode,gatewayOrderId:order.gateway_order_id};
   code.textContent=postCode;checkout.href=order.upi_intent;checkout.hidden=false;publish.hidden=false;publish.disabled=false;
   panel.hidden=false;message.textContent="Complete the ₹1 payment in your UPI app. Return here, then tap “I've paid”. Your post details are still only in this browser.";
   publishStatus.textContent="Nothing has been saved to the database yet.";panel.scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){showMessage(error.message);}
  finally{submit.disabled=false;submit.innerHTML='Pay ₹1 to continue <span>↗</span>';}
 });
 publish.addEventListener("click",async()=>{
  if(!active||sending)return;sending=true;publish.disabled=true;publish.textContent="Saving post…";
  try{
   const result=await api("/api/posts",{method:"POST",body:JSON.stringify({post:active.post,post_code:active.postCode,gateway_order_id:active.gatewayOrderId})});
   if(!result.published)throw new Error("The database did not confirm publication.");
   message.textContent="Your post has been sent to the Sho1re1 database.";publishStatus.textContent="Published · "+result.post_code;
   checkout.hidden=true;publish.hidden=true;active=null;form.reset();
  }catch(error){message.textContent=error.message;publish.disabled=false;publish.textContent="I've paid — publish my post";}
  finally{sending=false;}
 });
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