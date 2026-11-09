const {JSDOM,VirtualConsole}=require('jsdom');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const install=require('./fixture.js');
const repo=path.resolve(__dirname,'..');
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
function seedTiedStudents(f) {
 f.stamps=[];
 for(let i=0;i<34;i++) {
  const email=String(21000+i)+'@festival.com',count=i<32?3:i===32?2:1;
  f.users.push({student_id:email,name:'공동학생'+i,role:'L1',is_approved:true});
  for(let j=0;j<count;j++)f.stamps.push({id:f.stamps.length+1,student_id:email,club_id:f.clubs[j].club_id,created_at:'2026-10-15T01:00:00Z'});
 }
}
async function until(test){for(let i=0;i<100;i++){if(test())return;await tick();}throw Error('Timed out waiting for UI');}
async function setup(page,options={}){
 const errors=[],v=new VirtualConsole();v.on('jsdomError',error=>{if(!/navigation|HTMLCanvasElement/.test(error.message))errors.push(error);});
 const dom=new JSDOM(fs.readFileSync(path.join(repo,page+'.html'),'utf8'),{url:'http://localhost/'+page+'.html'+(options.query||''),runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:v});
 const w=dom.window,d=w.document,intervals=[];
 w.matchMedia=query=>({matches:query.includes('761')?!!options.wide:false,addEventListener(){},removeEventListener(){}});
 w.setInterval=(fn,delay)=>(intervals.push({fn,delay}),intervals.length);w.clearInterval=()=>{};
 w.lucide={createIcons(){}};w.confetti=()=>{};
 const fixture=install(w,{role:options.role,stubQr:true,reviewTies:!!options.reviewTies});
 if(options.before)options.before(fixture,w);
 for(const name of ['config.js','app-service.js','ui-shared.js',...(page==='index'?['pwa-ui.js']:[]),page==='index'?'student.js':page+'.js'])w.eval(fs.readFileSync(path.join(repo,name),'utf8'));
 await tick();
 return {dom,w,d,fixture,intervals,errors,click(selector){const element=d.querySelector(selector);assert(element,'Missing control: '+selector);element.click();},submit(selector){const form=d.querySelector(selector);assert(form,'Missing form: '+selector);form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));},close(){assert.deepEqual(errors,[]);dom.window.close();}};
}
(async()=>{
 let t=await setup('index');
 await until(()=>t.d.querySelectorAll('.ft-stamp-card').length===8);
 assert.equal(t.d.querySelectorAll('.ft-stamp-card.done').length,3);
 assert.equal(t.fixture.channels.length,0,'Students must not occupy realtime channels');
 t.click('[data-action=manual]');
 assert.equal(t.d.querySelector('#ft-manual-booth').value,'band-9','Use stable booth IDs, not indices');
 t.d.querySelector('#ft-manual-code').value='654321';t.submit('[data-form=manual]');
 await until(()=>t.d.querySelector('.ft-error').textContent.includes('만료'));
 assert.equal(t.d.querySelectorAll('.ft-stamp-card.done').length,3);
 let release;t.fixture.gates.check_otp_and_stamp=new Promise(resolve=>release=resolve);
 t.d.querySelector('#ft-manual-code').value='123456';t.submit('[data-form=manual]');t.submit('[data-form=manual]');
 await tick();assert.equal(t.d.querySelectorAll('.ft-stamp-card.done').length,3,'No optimistic stamp before RPC response');
 assert.equal(t.fixture.calls.filter(call=>call.name==='check_otp_and_stamp').length,2,'One expired request plus one pending request');
 release();await until(()=>t.d.querySelectorAll('.ft-stamp-card.done').length===4);
 t.click('[data-action=student-tab][data-tab=ranking]');await until(()=>t.d.querySelector('.ft-my-rank strong')?.textContent.includes('위'));
 assert(!t.d.querySelector('.ft-my-rank strong').textContent.includes('undefined'));
 assert(!t.d.body.textContent.includes('20201'),'Public rankings must stay masked');
 t.click('.ft-student-footer [data-action=credits]');assert(t.d.querySelector('[role=dialog]').textContent.includes('개발 총괄'),'Footer opens existing configured credits');t.click('[data-action=close-modal]');
 t.close();console.log('PASS student: stable IDs, expired RPC, no optimistic/duplicate writes, masked ranking, configured credits');

 t=await setup('index');await until(()=>t.d.querySelectorAll('.ft-stamp-card').length===8);
 assert.deepEqual([...t.d.querySelectorAll('[role=tab]')].map(tab=>tab.textContent),['도장판','학생 랭킹','동아리 랭킹']);
 assert(!t.d.querySelector('[data-tab=credits]'));
 const beforeClubs=t.fixture.calls.length;
 t.click('[data-action=student-tab][data-tab=clubs]');await until(()=>t.d.querySelectorAll('.ft-club-rank').length===8);
 const clubRows=[...t.d.querySelectorAll('.ft-club-rank')];
 const counts=clubRows.map(row=>Number(row.querySelector('.ft-club-rank-count b').textContent.replace(/[^0-9]/g,'')));
 assert(counts[0]>3,'Club counts include other students even when direct stamp reads are restricted to the current student');
 assert.deepEqual(counts,[...counts].sort((a,b)=>b-a));
 assert.equal(clubRows[0].querySelector('h3').textContent,'코딩 동아리','Club names remain unmasked');
 assert(t.fixture.calls.slice(beforeClubs).every(call=>call.method==='rpc'&&call.name==='get_club_leaderboard'),'Club ranking uses only the aggregate endpoint');
 const personal=await t.w.StampTourService.studentStamps('20101');assert.equal(personal.length,3,'Fixture enforces student row visibility');
 const firstId=clubRows[0].dataset.clubId;
 t.fixture.stamps.push({id:9999,student_id:'new-visitor@festival.com',club_id:firstId,created_at:new Date().toISOString()});
 t.click('[data-action=refresh]');await until(()=>t.d.querySelector('.ft-club-rank-count b')?.textContent===(counts[0]+1)+'명');
 t.click('.ft-student-footer [data-action=credits]');assert(t.d.querySelector('[role=dialog]').textContent.includes('개발 총괄'));
 t.click('[data-action=close-modal]');assert.equal(t.d.querySelector('[role=tab][aria-selected=true]').dataset.tab,'clubs');
 assert.equal(t.fixture.channels.length,0);t.close();
 console.log('PASS club ranking: aggregate counts, descending order, full names, refresh and footer credits');

 t=await setup('index',{query:'?tab=clubs',before(f){
   f.stamps=[];
   for(const [club_id,student_id] of [['club-code','one'],['club-code','two'],['club-code','two'],['band-9','one'],['band-9','two'],['photo-A','one']])f.stamps.push({id:f.stamps.length+1,club_id,student_id,created_at:new Date().toISOString()});
   f.clubs.find(club=>club.club_id==='photo-A').name='<img src=x>긴 동아리 이름';
 }});
 await until(()=>t.d.querySelectorAll('.ft-club-rank').length===8);
 const tied=[...t.d.querySelectorAll('.ft-club-rank')];
 assert.deepEqual(tied.slice(0,3).map(row=>row.querySelector('.ft-club-rank-position').textContent),['1','1','2']);
 assert.equal(tied[0].querySelector('.ft-club-rank-count b').textContent,'2명','Count distinct visitors');
 assert(tied.slice(3).every(row=>row.querySelector('.ft-club-rank-position').textContent==='—'));
 assert.equal(t.d.querySelector('[data-club-id="photo-A"] h3').textContent,'<img src=x>긴 동아리 이름');
 assert(!t.d.querySelector('.ft-club-rank img'));t.close();
 t=await setup('index',{query:'?tab=clubs',before(f){f.stamps=[];}});
 await until(()=>t.d.querySelectorAll('.ft-club-rank').length===8);assert(t.d.body.textContent.includes('아직 방문 기록이 없어요.'));t.close();
 t=await setup('index',{query:'?tab=clubs',before(f){f.clubs=[];f.stamps=[];}});
 await until(()=>t.d.body.textContent.includes('아직 등록된 동아리 부스가 없어요.'));t.close();
 console.log('PASS club ranking boundaries: shared ranks, unique visitors, zero visits, no booths and escaped names');

 t=await setup('index',{query:'?tab=clubs',before(f){f.fail.add('get_club_leaderboard');}});
 await until(()=>t.d.querySelector('.ft-club-ranking [role=alert]'));
 assert.equal(t.d.querySelectorAll('.ft-club-rank').length,0);
 assert(!t.fixture.calls.some(call=>call.table==='stamp_logs'),'Students never request administrator logs');
 t.fixture.fail.delete('get_club_leaderboard');t.click('.ft-club-ranking [data-action=refresh]');
 await until(()=>t.d.querySelectorAll('.ft-club-rank').length===8);assert(!t.d.querySelector('.ft-club-ranking [role=alert]'));t.close();
 t=await setup('index');await until(()=>t.d.querySelectorAll('.ft-stamp-card').length===8);
 let releaseClubs;t.fixture.gates.get_club_leaderboard=new Promise(resolve=>releaseClubs=resolve);
 t.click('[data-action=student-tab][data-tab=clubs]');await tick();t.click('[data-action=student-login]');
 await until(()=>t.d.querySelector('[data-form=student]'));releaseClubs();await tick();
 assert(!t.d.querySelector('.ft-club-ranking'));t.close();
 console.log('PASS club ranking lifecycle: load failure, retry and discarded responses after account logout');

 t=await setup('index',{query:'?tab=ranking',before:seedTiedStudents});
 await until(()=>t.d.querySelectorAll('.ft-podium .ft-place').length===3);
 assert.equal(t.d.querySelectorAll('.ft-rank-row').length,20);
 assert([...t.d.querySelectorAll('.ft-rank-row > span:first-child')].every(node=>node.textContent==='1'));
 assert(t.d.querySelector('.ft-place[data-rank="1"] .ft-winner-name').textContent.endsWith(' 외 31명'),'Podium counts all 32 tied students, including those outside TOP 20');
 assert(!t.d.querySelector('.ft-place[data-rank="2"] .ft-winner-name').textContent.includes('외 '),'Single rank omits 외 0명');
 assert.equal(t.d.querySelector('.ft-place[data-rank="2"] .ft-podium-block').textContent,'2개SILVER');
 assert.equal(t.d.querySelector('.ft-place[data-rank="3"] .ft-podium-block').textContent,'1개BRONZE');
 assert(!t.d.querySelector('.ft-podium').textContent.includes('공동학생0'),'Student representatives remain masked');t.close();
 t=await setup('admin',{before:seedTiedStudents});await until(()=>t.d.querySelector('.ft-admin-app'));
 t.click('[data-action=admin-tab][data-tab=ranking]');await until(()=>t.d.querySelectorAll('.ft-podium .ft-place').length===3);
 assert(t.d.querySelector('.ft-place[data-rank="1"] .ft-winner-name').textContent.endsWith(' 외 31명'));t.close();
 t=await setup('index',{query:'?tab=ranking',before(f){f.fail.add('get_stamp_podium');}});
 await until(()=>t.d.body.textContent.includes('공동 순위 정보를 불러오지 못했어요.'));assert(!t.d.querySelector('.ft-podium'));
 assert.equal(t.d.querySelectorAll('.ft-rank-row').length,20,'A missing new podium endpoint must not hide the existing TOP 20');
 assert(t.d.querySelector('.ft-my-rank strong').textContent.includes('위'),'Existing own rank remains available during migration rollout');
 t.fixture.fail.delete('get_stamp_podium');t.click('[aria-label="랭킹 새로고침"]');
 await until(()=>t.d.querySelectorAll('.ft-podium .ft-place').length===3);t.close();
 console.log('PASS student podium: distinct rank groups, ties beyond TOP 20, masked representatives, administrator parity and retry');

 t=await setup('index',{query:'?tab=clubs',before(f){
  f.stamps=[];
  [4,4,3,3,2,1,0,0].forEach((count,i)=>{for(let j=0;j<count;j++)f.stamps.push({id:f.stamps.length+1,student_id:'visitor-'+j,club_id:f.clubs[i].club_id,created_at:'2026-10-15T01:00:00Z'});});
 }});
 await until(()=>t.d.querySelectorAll('.ft-podium .ft-place').length===3);
 assert(t.d.querySelector('.ft-place[data-rank="1"] .ft-winner-name').textContent.endsWith(' 외 1곳'));
 assert(t.d.querySelector('.ft-place[data-rank="2"] .ft-winner-name').textContent.endsWith(' 외 1곳'));
 assert(!t.d.querySelector('.ft-place[data-rank="3"] .ft-winner-name').textContent.includes('외 '));
 assert(t.d.querySelector('.ft-place[data-rank="1"] .ft-winner-name').textContent.includes('동아리'));
 assert(!t.d.querySelector('.ft-podium .ft-winner-name').textContent.includes('*'));
 assert.equal(t.d.querySelectorAll('.ft-club-rank').length,8,'Full booth list remains available below the grouped podium');t.close();
 t=await setup('index',{query:'?tab=clubs',before(f){f.stamps=f.clubs.map((club,i)=>({id:i+1,student_id:'one',club_id:club.club_id,created_at:'2026-10-15T01:00:00Z'}));}});
 await until(()=>t.d.querySelector('.ft-podium'));
 assert.equal(t.d.querySelectorAll('.ft-podium .ft-place').length,1);
 assert(t.d.querySelector('.ft-place[data-rank="1"] .ft-winner-name').textContent.endsWith(' 외 7곳'));t.close();
 console.log('PASS club podium: one representative per rank, 곳 units, singleton names and a single shared rank');

 t=await setup('index',{query:'?tab=ranking',reviewTies:true});
 await until(()=>t.d.querySelector('.ft-place[data-rank="1"] .ft-winner-name'));
 assert(t.d.querySelector('.ft-place[data-rank="1"] .ft-winner-name').textContent.endsWith(' 외 1명'));
 t.click('[data-action=student-tab][data-tab=clubs]');await until(()=>t.d.querySelectorAll('.ft-club-rank').length===8);
 assert(t.d.querySelector('.ft-place[data-rank="1"] .ft-winner-name').textContent.endsWith(' 외 1곳'));t.close();
 console.log('PASS review example: both boards contain a visible shared first rank');

 t=await setup('index',{role:'none'});await until(()=>t.d.querySelector('[data-form=student]'));
 t.submit('[data-form=student]');await until(()=>t.d.querySelector('.ft-error').textContent.includes('5자리'));
 t.d.querySelector('#ft-student-id').value='20101';t.d.querySelector('#ft-student-name').value='검토학생';t.fixture.fail.add('auth');t.submit('[data-form=student]');
 await until(()=>t.d.querySelector('.ft-error').textContent.includes('실패'));
 assert.equal(t.w.localStorage.getItem('student_session'),null);
 t.fixture.fail.delete('auth');t.submit('[data-form=student]');await until(()=>t.d.querySelectorAll('.ft-stamp-card').length===8);
 assert.equal(JSON.parse(t.w.localStorage.getItem('student_session')).name,'검토학생');t.close();
 console.log('PASS student: registration validation, failed auth, real auth success boundary');

 t=await setup('index');await until(()=>t.d.querySelectorAll('.ft-stamp-card').length===8);
 t.click('[data-action=scan]');await until(()=>t.fixture.camera?.isScanning);
 t.click('[data-action=close-modal]');await tick();assert(t.fixture.cameraStops>0);
 let readyCamera;t.fixture.gates.camera=new Promise(resolve=>readyCamera=resolve);
 t.click('[data-action=scan]');await tick();t.click('[data-action=close-modal]');readyCamera();await tick();
 assert(!t.fixture.camera.isScanning,'Late camera resolution must be released after closing');t.close();
 console.log('PASS camera: closing active and pending-start scanners releases the camera');

 t=await setup('index',{before(f){for(let i=0;i<30;i++){const email='209'+i+'@festival.com';f.users.push({student_id:email,name:'비공개'+i,role:'L1'});for(let j=0;j<6;j++)f.stamps.push({id:f.stamps.length+1,student_id:email,club_id:f.clubs[j].club_id,created_at:new Date(Date.UTC(2026,9,15,1,i,j)).toISOString()});}}});
 await until(()=>t.d.querySelectorAll('.ft-stamp-card').length===8);t.click('[data-action=student-tab][data-tab=ranking]');
 await until(()=>/\d+위/.test(t.d.querySelector('.ft-my-rank strong')?.textContent||''));
 assert(Number(t.d.querySelector('.ft-my-rank strong').textContent.replace('위',''))>20,'Own rank is not limited to the top 20');t.close();
 console.log('PASS rankings: own rank outside TOP 20 remains visible');

 t=await setup('portal',{role:'none',wide:true,query:'?role=admin'});await until(()=>t.d.querySelector('[data-form=portal]'));
 assert(t.d.querySelector('.ft-admin-login'),'Admin desktop login layout');
 t.submit('[data-form=portal]');await until(()=>t.d.querySelector('.ft-error').textContent.includes('비밀번호'));
 assert(!t.fixture.calls.some(call=>call.method==='signIn'));
 t.click('[data-action=portal-role][data-role=booth]');assert(t.d.querySelector('.ft-mobile-portal'),'Booth login keeps mobile width');
 const select=t.d.querySelector('select[name=booth]');assert.equal(select.value,'club-code');
 t.d.querySelector('input[name=password]').value='wrong';t.submit('[data-form=portal]');await until(()=>t.d.querySelector('.ft-error').textContent.includes('비밀번호'));
 t.d.querySelector('input[name=password]').value='review-only';t.submit('[data-form=portal]');await until(()=>t.w.localStorage.getItem('current_session_token')!=='review-token'&&t.w.localStorage.getItem('current_session_token'));
 assert.equal(JSON.parse(t.w.sessionStorage.getItem('session_token')).boothId,'club-code');
 assert(!t.w.localStorage.getItem('current_session_token').includes('review-only'));t.close();
 console.log('PASS staff login: no blank bypass, role layouts, wrong password and original session/booth storage');

 t=await setup('booth',{query:'?boothId=club-code'});await until(()=>t.d.querySelector('[data-action=issue]'));
 t.click('[data-action=issue]');await until(()=>t.d.querySelector('#ft-booth-qr'));
 const payload=t.fixture.qrPayload,issued=t.fixture.clubs_status[0];assert.match(t.w.atob(payload),/^club-code:\d{6}$/);
 const expiry=issued.otp_expires_at;t.click('[data-action=code-mode][data-mode=manual]');
 assert.equal(t.d.querySelector('.ft-manual-code').textContent,issued.current_otp);
 assert.equal(t.fixture.clubs_status[0].otp_expires_at,expiry,'Display mode must not renew OTP');
 t.w.Date.now=()=>Date.parse(expiry)+1;t.intervals.find(timer=>timer.delay===1000).fn();
 assert(!t.d.querySelector('.ft-manual-code'));assert(t.d.body.textContent.includes('만료됐어요'));
 t.fixture.emit('users',{student_id:'club-code@festival.com',active_session_id:'different-session'});await tick();
 assert(t.d.querySelector('[data-action=session-exit]'));assert(!t.d.querySelector('#ft-booth-qr'));t.close();
 console.log('PASS booth: server-issued payload, identical QR/number, no renewal on switch, expiry and session revocation');

 t=await setup('admin',{role:'none'});await tick();assert(!t.d.querySelector('.ft-admin-app'));assert(!t.fixture.calls.some(call=>call.table==='stamps'));t.close();
 t=await setup('admin',{role:'L1'});await until(()=>t.d.querySelector('[data-action=session-exit]'));
 assert(!t.fixture.calls.some(call=>call.table==='stamps'));t.close();
 console.log('PASS authorization: protected data never loaded without the proper role');

 let releaseLogs;t=await setup('admin',{before(f){f.gates['stamp_logs:select']=new Promise(resolve=>releaseLogs=resolve);}});
 await until(()=>t.fixture.channels.length===2);
 t.fixture.emit('stamp_logs',t.fixture.stamp_logs[0]);releaseLogs();
 await until(()=>t.d.querySelectorAll('.ft-log-row').length===6);
 t.click('[data-action=expand-logs]');assert.equal(t.d.querySelectorAll('.ft-log-row').length,20,'Initial/realtime overlap is deduplicated');
 t.click('[data-action=clear-logs]');assert.equal(t.d.querySelectorAll('.ft-log-row').length,0);
 const next={id:999,student_id:'20101@festival.com',club_id:'club-code',created_at:new Date().toISOString(),status:'SUCCESS'};
 t.fixture.emit('stamp_logs',next);await tick();assert.equal(t.d.querySelectorAll('.ft-log-row').length,1,'New logs appear after clearing');
 assert(!t.fixture.calls.some(call=>call.op==='delete'));
 t.click('[data-action=admin-tab][data-tab=ranking]');await until(()=>t.d.querySelectorAll('#ft-desktop-ranking-body tr').length>1);
 const search=t.d.querySelector('#ft-admin-search');search.value='검색결과없음';search.dispatchEvent(new t.w.Event('input',{bubbles:true}));
 assert(t.d.querySelector('#ft-desktop-ranking-body').textContent.includes('검색 결과가 없어요'));
 assert(t.d.querySelector('.ft-podium'),'Filtering does not remove the overall podium');
 t.w.dispatchEvent(new t.w.Event('pagehide'));assert.equal(t.fixture.channels.length,0);t.close();
 console.log('PASS admin: initial/realtime dedup, display-only clear, new logs, search, podium and subscription cleanup');

 t=await setup('admin');await until(()=>t.d.querySelector('.ft-admin-app'));
 while(t.fixture.stamps.length<1005)t.fixture.stamps.push({id:t.fixture.stamps.length+1,student_id:'20101@festival.com',club_id:'club-code',created_at:'2026-10-15T01:00:00Z'});
 const metrics=await t.w.StampTourService.metrics();assert.equal(metrics.stamps,1005);assert(t.fixture.calls.some(call=>call.from===1000));
 t.fixture.fail.add('stamps:select');t.click('[data-action=admin-tab][data-tab=ranking]');await until(()=>t.d.querySelector('.ft-alert'));
 assert(t.d.body.textContent.includes('불러오지 못했어요'));t.close();
 console.log('PASS data boundaries: >1000-row pagination and visible network errors');
 t=await setup('admin',{before(f){f.fail.add('stamp_logs:select');}});
 await until(()=>t.d.querySelector('.ft-admin-app'));
 assert(t.d.body.textContent.includes('최근 인증 기록을 불러오지 못했어요.'),'Log failures remain visible when other dashboard queries succeed');
 t.fixture.fail.delete('stamp_logs:select');t.click('[data-action=retry]');
 await until(()=>t.d.querySelectorAll('.ft-log-row').length===6);
 assert(!t.d.body.textContent.includes('최근 인증 기록을 불러오지 못했어요.'));t.close();
 console.log('PASS admin errors: log fetch failure remains visible independently and clears after retry');
 console.log('All integration scenarios passed using isolated fixtures; no live Supabase writes.');
})().catch(error=>{console.error(error);process.exitCode=1;});
