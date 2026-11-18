import test from 'node:test';
import assert from 'node:assert/strict';
import {requiresConsent} from '../availability.js';
test('Inplannen vanaf 11:00 vraagt alleen bij afwijkende tijden toestemming',()=>{
 const availability={mode:'from',start:'11:00'};
 assert.equal(requiresConsent(availability,'09:00','18:00'),true);
 assert.equal(requiresConsent(availability,'11:00','18:00'),false);
 assert.equal(requiresConsent({mode:'until',end:'16:00'},'11:00','16:30'),true);
});
