const POSTS_API="https://sexpreets-post-api.sho1re1.workers.dev/api/posts";
function addCard(list,post){
  const card=document.createElement("a");
  card.className="page-card";
  const lat=Number(post.lat),lng=Number(post.lng);
  card.href=post.link||("https://www.openstreetmap.org/?mlat="+encodeURIComponent(lat)+"&mlon="+encodeURIComponent(lng)+"#map=17/"+encodeURIComponent(lat)+"/"+encodeURIComponent(lng));
  card.target="_blank";card.rel="noopener";
  const title=document.createElement("h3");title.textContent=post.title||"Untitled post";
  const desc=document.createElement("p");desc.textContent=[post.topic,post.type,post.subtype].filter(Boolean).join(" · ")||"Community post";
  const date=document.createElement("span");date.className="date";
  date.textContent=[post.post_code,post.created_on?new Date(post.created_on).toLocaleString():""].filter(Boolean).join(" · ");
  card.append(title,desc,date);list.append(card);
}
async function loadPages(){
  const list=document.getElementById("page-list"),count=document.getElementById("page-count");
  try{
    const response=await fetch(POSTS_API,{cache:"no-store"});
    if(!response.ok)throw new Error("Cloudflare posts unavailable");
    const payload=await response.json(),posts=Array.isArray(payload.posts)?payload.posts:[];
    count.textContent=posts.length+" "+(posts.length===1?"post":"posts");
    if(!posts.length){list.innerHTML='<div class="empty">No posts have been published yet. Create the first Sho1re1 community post.</div>';return;}
    posts.forEach(post=>addCard(list,post));
  }catch(error){
    count.textContent="Unavailable";
    list.textContent="Posts could not be loaded from Cloudflare. Please try again later.";
  }
}
document.addEventListener("DOMContentLoaded",loadPages);