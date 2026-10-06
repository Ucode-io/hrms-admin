import test from 'node:test';
import assert from 'node:assert/strict';
import {recordEnrollment,isUnresolvedDeviceRecord} from './record-identity.ts';
const routes=[{mac_address:'mac-a',companies_id:'burch'},{mac_address:'mac-b',companies_id:'burch'},{mac_address:'mac-c',companies_id:'fmz'}];
const users=[{mac_address:'mac-a',hikvision_id:'5',full_name:'Zohidjon',picture:'a'},{mac_address:'mac-b',hikvision_id:'5',full_name:'Zulfizar',picture:'b'},{mac_address:'mac-c',hikvision_id:'5',full_name:'FMZ',picture:'c'}];
test('same-company reused number never selects last enrollment face or name',()=>{assert.equal(recordEnrollment({companies_id:'burch',hikvision_id:'5'},users,routes),undefined);});
test('other-company enrollment cannot supply the picture',()=>{assert.equal(recordEnrollment({companies_id:'fmz',hikvision_id:'5'},users,routes).full_name,'FMZ');});
test('bound Zulfizar and Zohidjon records use their relation and scan, never numeric fallback',()=>{assert.equal(recordEnrollment({companies_id:'burch',hikvision_id:'5',source:'hikvision_device_binding_v1'},users,routes),undefined);});
test('unresolved rows are explicitly labeled even if accidentally linked',()=>{const item={companies_id:'burch',hikvision_id:'5',source:' HIKVISION_UNRESOLVED_V1 ',user_base_id:'unapproved'};assert.equal(isUnresolvedDeviceRecord(item),true);assert.equal(recordEnrollment(item,users,routes),undefined);});
test('duplicate audit rows for one device remain compatible, missing scope stays empty',()=>{assert.equal(recordEnrollment({companies_id:'burch',hikvision_id:'5'},[users[0],users[0]],[routes[0]]).full_name,'Zohidjon');assert.equal(recordEnrollment({hikvision_id:'5'},users,routes),undefined);});

test('partial enrollment inventory on a multi-device company cannot imply identity',()=>{assert.equal(recordEnrollment({companies_id:'burch',hikvision_id:'5'},[users[0]],routes),undefined);});
