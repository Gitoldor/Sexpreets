import test from "node:test";
import assert from "node:assert/strict";
import { validatePost, makePendingRecord } from "../worker/index.mjs";
const valid = { title:"Tea Shop",topic:"Food",type:"Business",subtype:"Cafe",lat:15.9064,lng:73.8317,plan:"FREE",plan2:"7D",image:"https://example.com/shop.jpg",link:"https://example.com" };
test("validates and normalizes a Sho1re1 post", () => { const post=validatePost(valid); assert.equal(post.title,"Tea Shop"); assert.equal(post.plan,"FREE"); assert.equal(post.lat,15.9064); });
test("rejects missing required fields", () => { assert.throws(() => validatePost({...valid,title:" "}),/required/); });
test("rejects invalid coordinates and unsafe URLs", () => { assert.throws(() => validatePost({...valid,lat:190}),/latitude and longitude/); assert.throws(() => validatePost({...valid,image:"javascript:alert(1)"}),/https/); });
test("creates a pending payment record without publishing it", () => { const record=makePendingRecord(valid,"fg_test","SHO-ABC123","2026-11-21T00:00:00.000Z"); assert.equal(record.status,"pending"); assert.equal(record.published,false); assert.equal(record.amount,10); assert.equal(record.postCode,"SHO-ABC123"); });
