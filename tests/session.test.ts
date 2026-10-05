import {test} from 'node:test';
import assert from 'node:assert/strict';
import {signSession,validSession,constantEqual} from '../lib/session.ts';
test('sessions reject tampering, wrong secrets and expiration',()=>{
 const secret='test-only-secret-that-is-at-least-32-chars';
 const token=signSession(secret,1000);
 assert.equal(validSession(token,secret,1001),true);
 assert.equal(validSession(token+'x',secret,1001),false);
 assert.equal(validSession(token,'another-secret',1001),false);
 assert.equal(validSession(token,secret,1000+8*60*60*1000),false);
 assert.equal(validSession('invalid',secret),false);
 assert.equal(constantEqual('correct','wrong'),false);
});
