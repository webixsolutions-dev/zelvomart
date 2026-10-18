import {test} from 'node:test';
import assert from 'node:assert/strict';
import {friendlyError} from '../../frontend/lib/app-errors';
test('server errors do not expose internal messages',()=>{
 assert.equal(friendlyError('SERVER_ERROR'),'Something went wrong on the server. Please try again.');
 assert.equal(friendlyError('Prisma database query failed',500),'Something went wrong on the server. Please try again.');
 assert.equal(friendlyError('INTERNAL_SECRET_CODE'),'Something went wrong. Please try again.');
});
test('network, timeout, permission and rate limits have actionable messages',()=>{
 assert.match(friendlyError(new TypeError('Failed to fetch')),/connection/);
 assert.match(friendlyError(Object.assign(new Error(),{name:'TimeoutError'})),/too long/);
 assert.match(friendlyError('',401),/sign in/);assert.match(friendlyError('',403),/permission/);assert.match(friendlyError('',429),/wait/);
 assert.equal(friendlyError('Please select a category.'),'Please select a category.');
});
