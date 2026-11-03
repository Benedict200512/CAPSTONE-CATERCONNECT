// Documentation-only build tooling. Reads project source; never connects to services.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'../..');
const ts=require(path.join(root,'caterconnect-mobile/node_modules/typescript'));
function files(dir){return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name]);}
const roots=['caterconnect-mobile/app','caterconnect-mobile/screens','caterconnect-mobile/components','caterconnect-mobile/context','caterconnect-mobile/hooks','caterconnect-mobile/lib','caterconnect-mobile/constants','caterconnect-mobile/supabase/functions','caterconnect-web/src','supabase/metadata','supabase/proposals'];
const sources=roots.flatMap(files).filter(f=>/\.(tsx?|sql|json|txt|md)$/.test(f)&&!f.includes('last_payment_reference_'));
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
function inspect(f){const text=read(f),sf=ts.createSourceFile(f,text,ts.ScriptTarget.Latest,true,f.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);const ui=[],calls=[];
 const add=(list,n,s)=>list.push({line:sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1,text:s});
 function visit(n){if(ts.isJsxText(n)&&n.text.trim())add(ui,n,n.text.replace(/\s+/g,' ').trim());
  if(ts.isJsxAttribute(n)&&/^(placeholder|accessibilityLabel|title)$/.test(n.name.text)&&n.initializer)add(ui,n,n.getText(sf));
  if(ts.isPropertyAssignment(n)&&/^(label|title|text|question|answer|desc|description)$/.test(n.name.getText(sf))&&ts.isStringLiteralLike(n.initializer))add(ui,n,n.initializer.text);
  if(ts.isCallExpression(n)&&/Alert\.alert|\.rpc$|\.invoke$|router\.(push|replace)|alert$|confirm$/.test(n.expression.getText(sf)))add(calls,n,n.getText(sf).slice(0,700));
  ts.forEachChild(n,visit);
 }visit(sf);return{file:f,ui,calls};}
if(process.argv[2]==='inspect'){
 for(const f of sources.filter(f=>process.argv.slice(3).some(s=>f.includes(s))&&/\.tsx?$/.test(f))){console.log(JSON.stringify(inspect(f)));}
}else if(process.argv[2]==='logic'){
 for(const f of sources.filter(f=>process.argv.slice(3).some(s=>f.includes(s))&&/\.tsx?$/.test(f))){const s=read(f);console.log(f+'\n'+s.split(/const (?:styles|s):?[^\n]*= (?:StyleSheet\.create|\{)/)[0]);}
}
if(!process.argv[2]||process.argv[2]==='build')build();
function build(){
const out=__dirname,features=[],screenshots=[],chunks=[];
const M='caterconnect-mobile/',W='caterconnect-web/src/',A=M+'app/',S=M+'screens/auth/',L=M+'lib/',E=M+'supabase/functions/';
const home=A+'(tabs)/index.tsx',cb=A+'(tabs)/bookings.tsx',catb=A+'(caterer)/bookings.tsx',wizard=A+'(tabs)/book/[catererId].tsx';
const web=n=>W+'pages/'+n+'.tsx';
const add=s=>chunks.push(s.trim()+'\n');
const table=(heads,rows)=>'| '+heads.join(' | ')+' |\n| '+heads.map(()=> '---').join(' | ')+' |\n'+rows.map(r=>'| '+r.map(v=>String(v).replace(/\|/g,'/').replace(/\n/g,' ')).join(' | ')+' |').join('\n');
const titles=['INTRODUCTION','CUSTOMER USER MANUAL','CATERER USER MANUAL','PLATFORM STAFF USER MANUAL','SYSTEM ADMINISTRATOR USER MANUAL','PAYMENT, SUBSCRIPTION AND REFUND OPERATIONS','SYSTEM WORKFLOWS','COMMON ERRORS AND TROUBLESHOOTING','DATA PRIVACY AND SECURITY','SYSTEM LIMITATIONS','GLOSSARY','APPENDICES'];
const roleChapter={Customer:2,Caterer:3,'Platform Staff':4,Administrator:5};
let chapter=0;
function ch(n,intro){chapter=n;add(`# CHAPTER ${n} — ${titles[n-1]}\n\n${intro}`);}
function feature(role,title,purpose,steps,result,notes,source,status='IMPLEMENTED',route=''){
 const count=features.filter(f=>f.role===role).length+1,number=roleChapter[role]+'.'+count;
 const id=({Customer:'CU',Caterer:'CA','Platform Staff':'ST',Administrator:'AD'})[role]+String(count).padStart(2,'0');
 const f={id,role,title,purpose,steps,result,notes,source,status,route,number};features.push(f);
 add(`### ${number}. ${title}\n\n**Feature ID:** ${id}  \n**Status:** ${status}  \n**Purpose:** ${purpose}\n\n**Steps:**\n${steps.map((s,i)=>`${i+1}. ${s}`).join('\n')}\n\n**Expected Result:** ${result}\n\n**Important Notes:** ${notes}\n\n**Source reference:** ${source.map(x=>'`'+x+'`').join('; ')}.`);
}
function shot(id,title,role,route,capture){screenshots.push({id,title,role,route,capture});add(`**Figure ${id}. ${title}**\n\n[Insert actual screenshot of ${title}. ${capture}]`);}
add(`# CaterConnect: An Online Marketplace for Catering Services\n\n## COMPLETE SYSTEM USER MANUAL\n\nBachelor of Science in Information Technology — Capstone Documentation\n\n**Prepared for:** Customers, Caterers, Platform Staff, and System Administrators  \n**Institution:** [Insert institution]  \n**Prepared by:** [Insert capstone proponents]  \n**Adviser:** [Insert adviser]  \n**Document version:** 1.0 — source-based review edition  \n**Source review date:** 20 October 2026, Asia/Manila  \n**Application identifiers:** caterconnect-mobile 1.0.0; web project 0.0.0\n\n**Submission condition:** Insert approved screenshots and complete the acceptance checklist before presenting this as an operationally validated manual. Screenshots and live deployment verification are not fabricated.`);
add(`## Document control and reading convention\n\nThis manuscript describes the inspected workspace, including current uncommitted changes. It is a documentation-only deliverable. No application, SQL migration, payment setting, permission, Edge Function or production record was modified to prepare it. Source presence proves a procedure has been implemented locally; it does not prove that all supporting database objects or deployed builds match this source.\n\n**IMPLEMENTED** means an actionable screen or server path was confirmed in code. **CONDITIONAL** means that path exists but requires a particular booking state, permission, deployment or supporting database configuration that is not fully confirmed. **PLANNED** means a proposed capability without a connected current implementation. **UNVERIFIED** means that availability or completion cannot be established; an inactive control is explicitly identified rather than given invented steps.\n\nWhen an expected result does not appear, refresh and verify the saved record. Do not assume a successful-looking message proves a database change. Money examples use Philippine pesos (PHP); provider test transactions are not evidence of live-money settlement. Screen wording takes precedence over illustrative placement descriptions.\n\nThe feature matrix supplies traceability to files. Appendix C lists real routes; Appendix E lists source coverage and limitations. Routine Internet, storage permissions and server authorization remain prerequisites even for an IMPLEMENTED feature.`);
add('## Table of contents\n\n'+titles.map((t,i)=>`${i+1}. CHAPTER ${i+1} — ${t}`).join('\n')+'\n\nThe DOCX includes a Word contents field and footer page numbers. Open it in Word, update fields and refresh the entire table after inserting screenshots. Markdown does not have fixed physical page numbers.');
ch(1,'This chapter introduces the system, its users, prerequisites and the limits of this source-based manual.');
add(`## 1.1. Purpose, system overview and objectives\n\nCaterConnect connects customers planning events with local catering businesses. Customers browse approved caterers, compare published packages, enter event details, request a booking, pay a downpayment and communicate in the related booking conversation. Caterers maintain offers, accept eligible requests, manage event schedules and handle refund obligations. Staff oversee business verification, complaints, bookings and refund evidence. Administrators oversee accounts, subscriptions, reports, moderation history and maintenance.\n\nThe implemented design aims to make offers and booking information easier to compare; coordinate event requests and communication; separate private caterer notes from customer-visible content; record server-verified Xendit payments; and provide role-specific operational oversight. These are system functions, not guarantees of service quality, payment settlement or dispute outcomes. The application uses subscription billing for caterers. The zero-commission wording is an interface policy statement, not an independently audited provider-fee arrangement.\n\n## 1.2. Intended users and access\n\n${table(['Role','Primary platform','Permitted scope','Key restriction'],[
['Customer','Expo React Native mobile app','Own profile, requests, booking conversations, payments, reviews and complaints','Cannot publish packages, activate plans or access caterer internal notes'],
['Caterer','Expo React Native mobile app','Own business, offers, assigned bookings, event availability and plan purchases','Cannot manage another caterer’s records or declare a customer refund received'],
['Platform Staff','React web portal, /staff','Verification, complaint handling and monitoring tools','Not an administrator; refund screen does not send money or confirm receipt'],
['Administrator','React web portal, /admin; also authorized /staff routes','Administrative accounts, reports, maintenance and operational oversight','Cannot use the ordinary customer signup form to assign privileged roles']
])}\n\nPublic registration presents Customer and Caterer only. Staff creation is a separate administrator-authorized workflow for a new account. An administrator can open Staff routes because App.tsx permits both staff and admin there, although the administrator sidebar retains administrator navigation. A route guard is one layer: database authorization must independently permit each query and operation.\n\n## 1.3. Platforms and system requirements\n\nThe mobile project uses Expo SDK ~54.0.34, React Native 0.81.5 and React 19.1.0. It is configured for portrait orientation, Android package com.anonymous.caterconnectmobile, iOS/tablet support and the caterconnect URL scheme. The project also declares a web target, but this manual treats Customer/Caterer as mobile roles. The Staff/Admin portal uses React 19.2.x, Vite 8 and React Router.\n\nFor end users, use a project-provided compatible Android build or an Expo Go client compatible with the project SDK and a working Internet connection. iOS operation is configured but must be tested with the actual distributed build. No signed store listing, minimum supported OS specification, storage/RAM benchmark or production portal URL was verified. Obtain the correct install file, QR code and portal URL from the capstone team; this manual does not invent them. A desktop browser with JavaScript, downloads and document-preview support is recommended for the portal. Browser/version compatibility must be tested on the submission environment.\n\nPhoto uploads require photo-library permission. Map search requests foreground location permission; typing a venue is an alternative. Device permissions do not grant database access. Hosted checkout needs network access and may open another application or browser. Configure the device for Philippine local time for consistent event-date previews. Some screens use device-local formatting even though availability/quota/report logic specifies Asia/Manila.\n\n## 1.4. Internet, installation and operating prerequisites\n\nAn Internet connection is required to authenticate, retrieve offers, submit requests, upload evidence, synchronize conversations and check payments. The reviewed source does not establish an offline transaction queue or offline booking/payment mode. If connectivity fails during submission, check whether the record already exists before retrying.\n\nFor a supervised Expo Go demonstration, the project operator installs dependencies in caterconnect-mobile and starts the configured npm start command, then provides the QR code. On Android, open the compatible Expo Go client and scan/open that project link. On iOS, use the supplied compatible Expo Go link/build. Network restrictions may prevent a local development project from loading; contact the operator rather than changing backend settings. A developer-managed Expo session is not equivalent to a published app-store installation.\n\nFor the portal, open the supplied URL and use the Staff/Admin account issued for that role. No staff self-registration or verified public password-recovery process is provided in the inspected portal.\n\n## 1.5. Complete workflow overview\n\nCustomer registration → authenticated browsing → published package selection → event details and optional add-ons → pending request → caterer confirmation or rejection → verified downpayment → event ongoing → event completed → customer review.\n\nCancellation branches into either no refund or a recorded refund obligation. The caterer transfers funds outside the application, submits proof, and the customer confirms actual receipt. An unresolved issue can be reported; Staff monitor evidence and manage general complaint tickets. Subscription purchases form a separate flow: caterer chooses a paid plan → Xendit checkout → authenticated, independently verified provider success → existing activation RPC → confirmed receipt, plan and 30-day expiry. Chapters 6 and 7 explain these branches.\n\n## 1.6. Operational vocabulary and authority\n\nA pending request is not an accepted reservation and does not reserve daily capacity. A confirmed booking is accepted but is not proof of collected money. A provider PAID status must be checked by the server, and the corresponding database update must be confirmed. A refund proof image is evidence submitted by a caterer, not proof that the customer has received funds. Database-confirmed results, not button presses or HTTP 200 alone, determine completion.`);
ch(2,'Use this chapter with a Customer account. The four visible mobile tabs are Home, Bookings, Messages and Profile. Guest browsing is available, while account-specific actions require sign-in.');
feature('Customer','Open CaterConnect or browse as a guest','Enter the correct mobile workspace.',[
'Open the project-provided mobile build or compatible Expo Go project.',
'Wait for the platform-status check to complete. If maintenance is active, read the notice and use the displayed retry control after the advised interval.',
'On the welcome screen choose Log in, Sign up or Continue as Guest.',
'For guest browsing, open Home and explore visible caterers; sign in when an account-required action requests it.'
],'The welcome page or Customer Home is displayed.','Do not assume a development QR code is a public installer. Maintenance errors restrict access until platform status can be checked.',[A+'(auth)/welcome.tsx',M+'components/MaintenanceGate.tsx'],'IMPLEMENTED','/(auth)/welcome');
feature('Customer','Register a Customer account','Create an account for personal event bookings.',[
'Select Sign up, then Customer on Join as a....',
'Enter FULL NAME, EMAIL ADDRESS, PHONE NUMBER, ADDRESS and PASSWORD.',
'Use a password of at least six characters; the strength indicator is advice, not a substitute for a strong password.',
'Expand the Customer Terms & Policies and read the displayed version; select the agreement checkbox.',
'Select CREATE ACCOUNT. After the account-created message, use the login screen and complete email confirmation if required.'
],'An account creation request is sent to Supabase and the app returns to login.','Name, email, password, phone, address and policy agreement are required by this form. The displayed policies are marked Draft for review; durable consent history and legal approval are not established by the checkbox alone.',[S+'RegisterScreen.tsx',L+'auth.ts',M+'constants/registrationPolicies.ts'],'IMPLEMENTED','/(auth)/register');
feature('Customer','Confirm an email address and resend a link','Complete email confirmation when required by the configured authentication service.',[
'Check the email address used at signup for the Supabase confirmation message, including junk folders.',
'Open the supplied verification link in the supported environment and return to CaterConnect.',
'If the Verify Your Email screen is accessible with the correct session email, select Resend Verification Email.',
'Read Email resent! Check your inbox., or the returned error; sign in again after completing confirmation.',
'Use Use a different account only when you intend to sign out.'
],'The authentication service confirms the email, or sends another link when permitted.','CONDITIONAL: Supabase email settings, redirect configuration and a valid session are required. Registration navigates to login; the root navigator does not universally enforce this screen. The unused useRequireVerified hook imports an absent isEmailVerified helper. Do not claim every booking is email-gated.',[S+'VerifyEmailScreen.tsx',L+'auth.ts',M+'hooks/useRequireVerified.ts',A+'_layout.tsx'],'CONDITIONAL','/(auth)/verify-email');
feature('Customer','Log in','Access personal records.',[
'Choose Log in on the welcome screen.',
'Enter EMAIL ADDRESS and PASSWORD. Use the eye icon to show or hide the password while typing.',
'Select LOG IN and wait for authentication and account-status checking.',
'If Login Failed appears, read the specific reason and correct the credentials or contact the project operator.',
'After successful login, use Home, Bookings, Messages or Profile.'
],'A recognized Customer account opens the Customer area.','Suspended accounts are signed out. A suspension reason is shown only if its lookup is authorized; otherwise a contact-support message appears. Forgot password? has no onPress handler; no working in-app reset procedure was verified.',[S+'LoginScreen.tsx',L+'auth.ts'],'IMPLEMENTED','/(auth)/login');
feature('Customer','Browse approved caterers and featured listings','Find businesses with public approved listings.',[
'Open Home and review Categories, Featured Caterers and Browse All.',
'Select an event category such as Wedding, Birthday or Corporate, or choose All.',
'Use Browse Now to move to the browsing list.',
'Use See All or Show Less to expand or reduce the featured list where shown.',
'Pull down to refresh if the list or ratings are stale.'
],'The displayed caterers and their matching published packages are refreshed.','The fetch filters verification_status=approved and published packages. A Verified badge represents that record state, not an independent guarantee. Standard/Premium featured priority is separate from a price sort.',[home,L+'caterers.ts'],'IMPLEMENTED','/(tabs)');
feature('Customer','Search, filter and sort caterers','Narrow the browsing results.',[
'Type a caterer name, dish, package or event term in Search caterers, dishes, or events....',
'Open the sliders icon beside the search field to display Search Filters.',
'Set optional Minimum budget (₱), Maximum budget (₱), Number of guests, Caterer city and Event type.',
'Choose Recommended, Price: Low to High, Price: High to Low, or Name: A–Z under Sort Browse All, then Apply Filters.',
'Use Clear Filters or Reset All to remove restrictions and try again if no caterers match.'
],'Browse All contains packages satisfying the applied query, event and numeric conditions.','City matches the listed city, not a verified delivery radius. Use valid currency with at most two decimals; minimum cannot exceed maximum. Featured placement retains subscription priority.',[home,L+'catererSearch.ts'],'IMPLEMENTED','/(tabs) → Search Filters');
feature('Customer','Use Smart Budget Matcher','Compare eligible base package quotations with a budget and guest count.',[
'On Home scroll to Smart Budget Matcher.',
'Open How does this work? if instructions are needed.',
'Enter Total budget and No. of Guests; use a positive whole guest count.',
'Select Find Matching Caterers.',
'Review Matched Caterers and Matching base total from, then inspect the chosen package before booking.'
],'Results use the full fixed package price plus extra guests above included capacity, subject to guest limits.','Optional menu additions are excluded. Your Budget Per Guest is a budget ratio, not an actual package quotation. Missing max_guests or invalid configuration can prevent a match. Backend fixed-pricing installation must be verified separately.',[home,L+'catererSearch.ts',L+'packagePricing.ts'],'CONDITIONAL','/(tabs) → Smart Budget Matcher');
feature('Customer','Inspect a caterer profile, packages, menu and reviews','Review offer details before committing.',[
'Open a caterer card from Home.',
'Read About and Contact & Location, including available phone, email and address.',
'Select Packages to review package tiers, food inclusions, service inclusions, suitable event types, fixed price and guest bounds.',
'Select Menu to inspect separately priced dishes, and Reviews to inspect category scores, comments and caterer responses.',
'Choose Book This Package for a specific offer, or Book Now to enter the wizard without a preselected offer.'
],'The chosen published package opens in the booking workflow when signed in.','The displayed approximate per-guest amount is package price divided by included capacity. It does not mean a smaller party pays proportionately less. A Book/Lock action may request login first.',[A+'(tabs)/caterer/[catererId].tsx',L+'caterers.ts'],'IMPLEMENTED','/(tabs)/caterer/[catererId]');
feature('Customer','Save and remove package bookmarks','Keep a personal shortlist.',[
'While signed in as a Customer, tap the heart on a published package.',
'Open Profile and select Saved Packages.',
'Select View package → or the package card to revisit its current listing.',
'Tap its saved heart/remove control to remove it when no longer needed.',
'For Package unavailable, remove the saved entry or return to browse other offers.'
],'The bookmark is persisted for the signed-in customer and reflected in the saved count.','Requires the existing package_bookmarks table and appropriate RLS. No migration for that table was verified in the collected exports. A saved package does not reserve availability or preserve its old price.',[A+'(tabs)/saved-packages.tsx',L+'packageBookmarks.ts',M+'hooks/usePackageBookmarks.ts'],'CONDITIONAL','Profile → Saved Packages');
feature('Customer','Compare packages','Compare published offers without submitting bookings.',[
'Use the package comparison control on an offer to add it to the selection.',
'Select two or three packages. Use the comparison bar to review the selected count.',
'Select Compare Now.',
'Swipe horizontally through Compare Packages to compare names, prices, guest bounds, tiers, descriptions, inclusions and event types.',
'Use View Package, Remove, Clear Selection or Return to Browsing as needed.'
],'The comparison shows current accessible package details.','Selection is temporary and scoped to the current Customer session; it is not a saved booking. The maximum is three packages. Unavailable packages cannot be booked from an old comparison.',[A+'(tabs)/package-comparison.tsx',M+'components/PackageComparisonControls.tsx',M+'context/PackageComparisonContext.tsx'],'IMPLEMENTED','/(tabs)/package-comparison');
feature('Customer','Choose a package in the booking wizard','Start a structured request.',[
'Select Book This Package or Book Now on a caterer profile.',
'In the Package step, read each offer and select the desired package if one was not already selected.',
'Review the package food and service inclusions and its minimum, included and maximum guests.',
'Use the forward control to continue to Details.'
],'The wizard retains the selected package and opens the event form.','The four stages are Package, Details, Customize and Review. A preselected package can open Details directly. An unpublished/archived package cannot be selected for a new booking.',[wizard,L+'packagePublication.ts'],'IMPLEMENTED','/(tabs)/book/[catererId]');
feature('Customer','Enter guests, date, time and event information','Describe the requested reservation.',[
'In Details select Event Date * from the availability calendar and Event Time * from the time picker.',
'Enter Number of Guests * as a whole number within the package minimum and maximum.',
'Select an Event Type * such as Wedding, Birthday, Debut, Corporate, Anniversary, Party or Other.',
'Enter Venue / Location * and any Special Requests, including relevant allergies or setup needs.',
'Continue only after availability finishes loading and no validation error remains.'
],'The form retains event details and recalculates the quotation.','Past, blocked and full dates are rejected. Availability is checked again on submission; a pending request reserves no slot. max_guests and the authoritative pricing guard must be installed before the updated pricing workflow is relied upon.',[wizard,L+'availability.ts',L+'packagePricing.ts'],'CONDITIONAL','Booking wizard → Details');
feature('Customer','Pin a venue on the map','Add coordinates to the venue description.',[
'In Event Details select Pin on Map.',
'Enter a landmark or address in Search & Pin Venue and allow foreground location permission if requested.',
'Use the search control or tap the map to position the marker.',
'Verify that the marker is at the intended venue; the starting map position is not an automatic identification of your event.',
'Select Confirm Venue Pin Location and review the resulting venue text.'
],'The venue field contains the selected location description and coordinates.','Search depends on geocoding and network/device permissions. If Location Not Found appears, try a more specific address or type the venue directly.',[wizard],'CONDITIONAL','Booking wizard → Pin on Map');
feature('Customer','Choose optional menu additions','Add separately priced dishes to a fixed package.',[
'Open Customize after completing event details.',
'Review dishes grouped by Main Course, Appetizer, Dessert and Drink.',
'Use + to add a dish or increase its quantity; use − to decrease or remove it.',
'Review Customization Add-ons and each selected quantity.',
'Continue to Review, or proceed without add-ons if none are required.'
],'Selected items and quantities contribute a separate add-on subtotal.','Each addition is price_per_guest × all guests × quantity. Serving-size descriptions do not replace this per-guest calculation. Existing menu rows may change; a trusted pricing guard must reject stale/manipulated quotes when installed.',[wizard,L+'packagePricing.ts'],'IMPLEMENTED','Booking wizard → Customize');
feature('Customer','Review fixed pricing and submit a booking request','Check the complete quotation before sending a request.',[
'In Review & Confirm verify Caterer, Package & Inclusions, Event Details and Add-ons.',
'Inspect Cost Breakdown: Fixed package price, Extra guests if any, Add-ons and TOTAL.',
'Check Downpayment Required and the displayed deadline; do not confuse the downpayment with the full total.',
'Use Back to correct an earlier step; otherwise select Submit Booking Request once.',
'On Booking Submitted! select View Bookings and verify that the pending request exists.'
],'The application inserts a pending booking and attempts to save its customization detail rows.','Within minimum–included capacity the full fixed price applies. Extra subtotal is rounded after multiplying the exact price/capacity ratio. A successful booking insert is not proof every secondary detail write succeeded. The UI promises review within 24 hours, but no service-time guarantee or automatic request-expiry job was established.',[wizard,L+'packagePricing.ts','supabase/proposals/fixed_package_pricing_EXECUTE.sql'],'CONDITIONAL','Booking wizard → Review');
feature('Customer','Monitor bookings, history and details','Track the saved booking lifecycle.',[
'Open Bookings and use the displayed status filters to locate the event.',
'Read the status badge, event date, guest count, venue, total and timeline.',
'Select View Booking Details for saved inclusions, special requests, cancellation information or refund evidence.',
'Pull down to refresh or reopen the screen after another participant changes the booking.',
'Use the relevant payment, chat, cancellation or review action only when it is offered for that booking.'
],'Current accessible bookings and saved status are displayed.','Confirmed means accepted, not paid. Awaiting-payment is a backend state but is not consistently represented in all mobile badge maps. Historical totals are read from bookings rather than recalculated from today’s package.',[cb,M+'hooks/useBookingRefresh.ts'],'IMPLEMENTED','/(tabs)/bookings');
feature('Customer','Pay an eligible booking downpayment through Xendit','Submit the required deposit securely.',[
'Find a confirmed eligible booking and select Pay ₱… Downpayment.',
'Review Booking Summary and Payment Breakdown, including Remaining Balance (Event Day).',
'Select a displayed caterer-supported payment option and choose Pay ₱… via Xendit.',
'Complete the available method in the hosted Xendit checkout. The actual channels depend on the Xendit account and test configuration.',
'Return to CaterConnect and wait for Payment Confirmed and the database-verified status. If Payment Processing appears, refresh later rather than paying again.'
],'A verified provider payment can update the matching booking to paid with stored reference and timestamps.','The return screen alone is not proof. Ineligible states, wrong amounts, missing verification or refund protections can prevent an update. This project uses Xendit test payments; no automatic event-day balance collection was verified.',[cb,L+'xendit.ts',E+'xendit-webhook/verify-booking-invoice.ts'],'CONDITIONAL','Bookings → Pay Downpayment');
feature('Customer','Read saved payment information','Distinguish verified deposit state from an open checkout.',[
'Return to Bookings after checkout.',
'Check the booking’s Payment Verified status and stored downpayment information.',
'If the result remains Confirmed or Payment Processing, refresh while online and allow webhook processing to complete.',
'If still unresolved, retain the provider reference privately and report the discrepancy through the existing support/complaint channel.',
'Do not upload unrelated evidence or attempt another payment merely to change the status.'
],'The displayed booking reflects the database state.','Current reviewed customer/caterer screens do not expose a complete non-Xendit booking receipt-upload/manual-approval procedure. Legacy receipt fields/helper code are not a user-facing manual verification feature. No such steps are invented here.',[cb,S+'PaymentScreen.tsx',E+'xendit-check-status/index.ts'],'IMPLEMENTED','Bookings → payment information');
feature('Customer','Open a booking conversation and send a message','Coordinate the event with the assigned caterer.',[
'Open the chat action on the booking, or choose an existing thread in Messages.',
'Check the participant name and expand Booking details to ensure the correct event is open.',
'Enter text in Type a message....',
'Select the send icon and wait for the saved message to appear.',
'Use Refresh or Retry if synchronization reports an error.'
],'The message is sent to the booking conversation and synchronized when the backend permits it.','The inbox is built from existing messages; a new booking may have no listed conversation until chat begins. Conversations are booking-related, not a public user directory. Real-time updates depend on Supabase publication/access configuration.',[S+'ChatScreen.tsx',S+'MessagesInboxScreen.tsx'],'IMPLEMENTED','/(tabs)/messages or booking chat modal');
feature('Customer','Use quick questions, emojis and photo messages','Send useful event-related content.',[
'In a booking chat open Quick Questions and tap a suggested question to draft it.',
'Edit the draft and press Send; choosing a question does not send it automatically.',
'Open the emoji picker to insert an emoji into the draft.',
'Use Attach photo, grant photo access, select an image and wait for upload completion.',
'Tap an image message to inspect its preview and confirm the correct material was shared.'
],'Drafts, text emojis and uploaded photos appear in the selected conversation after successful submission.','Photos can contain private information. Only attach necessary, accurate material. Upload or storage errors do not confirm message delivery; inspect the thread before retrying.',[S+'ChatScreen.tsx'],'IMPLEMENTED','Booking conversation');
feature('Customer','Add, change or remove a message reaction','React without sending another text message.',[
'Long-press a message bubble to show the reaction options.',
'Choose a quick reaction and observe the immediate local display.',
'Choose a different reaction on the same message to replace your reaction.',
'Choose your current emoji again to remove it.',
'If Reaction not saved appears, read the error and refresh the conversation.'
],'One reaction entry per participant is attempted in messages.reactions.','CONDITIONAL: the current helper writes the whole JSON reaction map and requires suitable RLS/column setup. It rolls back a failed local update but cannot guarantee atomic cross-account updates; concurrent reactions can be lost. A pending metadata review prevents claiming this issue is fully resolved.',[S+'ChatScreen.tsx',L+'messageReactions.ts'],'CONDITIONAL','Booking conversation → long-press message');
feature('Customer','Cancel an eligible booking','Withdraw a request or reservation under the displayed policy.',[
'In Bookings select Cancel on an eligible event.',
'Read Estimated Cancellation Refund and the warning; the preview is not a completed refund.',
'Choose a cancellation reason, or Other and a specific explanation of 3–1,000 characters.',
'If a refund is estimated, supply the requested wallet/bank destination and account holder.',
'Use the final cancellation confirmation, or Keep Booking to abandon the action; then inspect the saved booking status.'
],'The app calls cancel-customer-booking and displays the server-returned cancellation/refund result.','The endpoint source and cancellation RPC body are not supplied locally, so deployment-specific recomputation is unverified. The reviewed client preview applies the Chapter 6 schedule. Only offered eligible statuses can be cancelled; a completed event is not a normal cancellation path.',[cb,S+'FAQScreen.tsx'],'CONDITIONAL','Bookings → Cancel Booking');
feature('Customer','Provide and track a refund destination','Direct a refundable amount to the correct account.',[
'During refundable cancellation, choose GCash, Maya, BPI, BDO or Other Bank.',
'Enter Account holder’s full name and the wallet/account number; provide Bank name for Other Bank.',
'For GCash/Maya, use an 11-digit number beginning with 09; for bank destinations, use 6–20 digits.',
'Confirm cancellation and review the saved Destination, Refund Status and Refund Amount in booking details.',
'If a caterer-initiated cancellation shows destination missing, contact the caterer through the booking conversation and follow authorized platform guidance.'
],'The protected cancellation request can save the destination used by the caterer for transfer.','There is no verified separate in-app destination-completion endpoint for a later missing account; the screen explicitly identifies that limitation. Do not post account details publicly or interpret a pending obligation as money already returned.',[cb],'CONDITIONAL','Cancellation form; Booking Details → Cancellation & Refund');
feature('Customer','Inspect refund transfer evidence and confirm actual receipt','Close the refund only when funds have arrived.',[
'Open the cancelled booking’s View Booking Details and Refund Transfer Evidence.',
'Read the transfer reference, submission time and accessible proof image.',
'Check your own wallet or bank transaction history independently.',
'Only if the money arrived, select I Received My Refund and confirm I Received the Refund.',
'Refresh and check the stored processed status; otherwise choose Not Yet.'
],'confirm-customer-refund can mark actual receipt and update the tracked refund when authorized.','A screenshot is not receipt confirmation. The protected endpoint is called by the app but its deployed implementation is not included here. Only the customer confirms receipt; Staff do not confirm it for them.',[cb],'CONDITIONAL','Booking Details → Refund Transfer Evidence');
feature('Customer','Report a refund that has not arrived','Record an unresolved refund issue.',[
'Open the eligible cancelled booking and select I Haven’t Received My Refund.',
'Describe the issue in What happened? using 10–2,000 characters.',
'Select Submit Report once.',
'Review Issue Reported, the dispute status and any Caterer’s Investigation Response.',
'Continue communicating with the caterer and confirm receipt only after checking your account.'
],'A refund_disputes report is inserted; the refund remains unresolved until the authorized receipt workflow completes.','Only unresolved refund states are eligible. A duplicate report can be rejected. This is separate from a general complaint ticket; Staff’s current refund screen is monitoring only.',[cb],'CONDITIONAL','Bookings → Refund Not Received');
feature('Customer','File and follow a general complaint','Report service or platform problems for moderation.',[
'Open Profile → File a Complaint.',
'In New Complaint select COMPLAINT TYPE *, optionally specify the caterer/business in AGAINST and a SUBJECT.',
'Enter DESCRIPTION * and select the displayed PRIORITY LEVEL.',
'Select Submit Complaint and acknowledge the result.',
'Open My Reports to view the ticket status and Staff Resolution when available.'
],'An account-linked complaint is saved for Staff review.','The form requires type and description. Its 24–48 hour review wording is an interface expectation, not a verified service guarantee. This form does not automatically transfer money or adjudicate a refund.',[A+'(tabs)/complaints.tsx'],'IMPLEMENTED','/(tabs)/complaints');
feature('Customer','Use Help Center and FAQs','Find role-specific guidance.',[
'Open Profile → Help Center / FAQ.',
'Enter a term in Search FAQs... or select an available category.',
'Expand the relevant question and read the answer.',
'Clear or change the search if No matching questions appears.',
'Return to the relevant booking for an account-specific action.'
],'The local FAQ content is filtered and displayed.','FAQs describe intended workflows; they are not proof of backend deployment or payment success. A contact/support action, live consultation inbox and chat with Staff are not verified in current routes.',[S+'FAQScreen.tsx',A+'(tabs)/faq.tsx'],'IMPLEMENTED','/(tabs)/faq');
feature('Customer','Read notifications','Inspect account-related alerts.',[
'Tap the bell on Home or open Profile → Notifications.',
'Read the latest booking, message, payment, refund, review or subscription-related notices visible to the account.',
'Tap a notice to mark it read and attempt to open its linked record.',
'Select Mark all read to clear the displayed unread state.',
'Pull down to reload if needed; if a deep link fails, open Bookings or Messages directly.'
],'Up to 50 recent notifications are loaded and read states are updated.','Some routes use ungrouped /bookings or /profile paths and need device verification. This is an in-app notification list; push notifications and email delivery are not established by this component.',[S+'NotificationsScreen.tsx',home],'IMPLEMENTED','/(tabs)/notifications; Home bell modal');
feature('Customer','Review a completed event','Provide feedback for a completed booking.',[
'Find a completed booking and select Write Review.',
'Select a 1–5 star rating for Food Quality, Service Quality, Timeliness and Overall.',
'Optionally enter a comment of up to 500 characters.',
'Select Submit Review and wait for the thank-you message.',
'Return to Bookings and confirm Review Submitted is shown.'
],'A review associated with the booking, customer and caterer is inserted.','All four ratings are required. The booking screen offers the action for completed events without a loaded review; backend constraints/RLS must enforce ownership and uniqueness. Editing or deleting an existing review is not offered here.',[S+'ReviewScreen.tsx',cb],'IMPLEMENTED','Completed booking → Write Review');
feature('Customer','Read personal review history','Revisit feedback and caterer responses.',[
'Open Profile and tap Reviews.',
'Wait for My Reviews to load.',
'Read YOUR REVIEW, the rating and CATERER RESPONSE where one exists.',
'Use Try Again if loading fails or View My Bookings when there are no reviews.'
],'Only the current customer’s queried reviews are displayed.','This page reads history; it does not supply edit/delete controls. A zero or failed counter on Profile should not be treated as proof that no review exists.',[A+'(tabs)/my-reviews.tsx',A+'(tabs)/profile.tsx'],'IMPLEMENTED','/(tabs)/my-reviews');
feature('Customer','Edit profile information and avatar','Keep personal contact information current.',[
'Open Profile → Edit Profile.',
'Tap the camera/photo control and allow photo access if changing the avatar.',
'Update FULL NAME *, PHONE NUMBER and HOME ADDRESS.',
'Review the read-only Email Address and Account Role.',
'Select Save Changes and acknowledge the saved result.'
],'The profiles record and avatar reference are updated when permitted.','Full name cannot be empty. This form does not change the account’s email, password or role. Upload and text saves can occur separately; review the resulting profile if a network failure occurs.',[A+'(tabs)/edit-profile.tsx',L+'storage.ts'],'IMPLEMENTED','/(tabs)/edit-profile');
feature('Customer','Read About and log out','Review app information and end the session.',[
'Open Profile → About CaterConnect to read the information modal, then Done.',
'When finished, choose Log Out.',
'Read the confirmation and select Log Out again, or Cancel to remain signed in.',
'Confirm the welcome page appears before handing the device to another person.'
],'The session is signed out and the welcome screen opens.','The About version/build label is informational. Signing out does not cancel bookings, delete messages or erase saved financial history.',[A+'(tabs)/profile.tsx',L+'auth.ts'],'IMPLEMENTED','/(tabs)/profile');
shot('2.1','Customer registration and policy agreement','Customer','/(auth)/register','Show all required fields and the agreement without real credentials.');
shot('2.2','Home search and Smart Budget Matcher','Customer','/(tabs)','Show a controlled budget/guest example and matching base total.');
shot('2.3','Booking wizard Review and Cost Breakdown','Customer','Booking wizard → Review','Use the worked pricing example; show fixed price, extras, add-ons and deposit.');
shot('2.4','Database-confirmed booking payment','Customer','Bookings','Capture a permitted test booking after verified update, with references redacted.');
shot('2.5','Refund evidence and customer confirmation','Customer','Booking details','Use synthetic evidence and redact destination details.');
shot('2.6','Booking chat and customer review form','Customer','Messages; completed booking','Use consented test messages and a completed synthetic event.');
ch(3,'Use a Caterer account for your own catering business. The visible tabs are Dashboard, Packages, Menu, Bookings, Messages and Business. Reports and Availability open through Dashboard quick actions; Plans & Billing is a modal opened from Business or Upgrade.');
feature('Caterer','Register a business account','Create the non-privileged business owner identity.',[
'Choose Sign up → Caterer.',
'Enter FULL NAME, EMAIL ADDRESS, PASSWORD, BUSINESS NAME, PHONE NUMBER and CITY / SERVICE AREA.',
'Read View Full Terms & Conditions and select the Caterer agreement checkbox.',
'Select CREATE CATERER ACCOUNT.',
'Log in and open Business to complete the business profile and verification documents.'
],'The registration request uses role=caterer; the application describes the business as pending verification.','A password must have at least six characters. Registration alone does not approve a public listing, grant a paid plan or create Staff/Admin privileges.',[S+'RegisterScreen.tsx',L+'auth.ts'],'IMPLEMENTED','/(auth)/register');
feature('Caterer','Read the Caterer Dashboard','Monitor business activity and reach management tools.',[
'Log in with the Caterer account and open Dashboard.',
'Read Verification Required if displayed and use Edit Profile to reach Business.',
'Review Caterer Overview, Your Subscription, Booking Snapshot and Recent Bookings.',
'Use Quick Actions for Reports & Analytics, Availability, Packages, Menu Items or Bookings.',
'Open Bookings directly for a specific request and refresh when figures appear stale.'
],'Account-scoped booking counts and links are shown.','Counts are summaries, not independent payment evidence. A verification notice is distinct from email verification. Some dashboard links labelled Edit Profile first open Business, where the edit control opens the form.',[A+'(caterer)/index.tsx'],'IMPLEMENTED','/(caterer)');
feature('Caterer','Create or edit the business profile','Provide business and contact details customers can inspect.',[
'Open Business and tap its edit control to enter Business Profile.',
'Enter Business Name *, City / Area, Contact Phone, Contact Email, Business Address and Business Description.',
'Update the personal Full Name and Phone Number if necessary.',
'Review the displayed booking/payment settings before saving.',
'Select Save Business Profile and inspect the saved Business page.'
],'The app updates the appropriate profiles and caterers records.','Business name is required. The page can create a pending caterer record when one is absent. Separate profile/business writes can partly succeed on connection loss; reopen to verify. Changes do not automatically approve business verification.',[A+'(caterer)/edit-profile.tsx',A+'(caterer)/profile.tsx'],'IMPLEMENTED','/(caterer)/edit-profile');
feature('Caterer','Upload a business logo and cover photo','Identify the business visually.',[
'Open the Business Profile editor.',
'Tap the logo camera control or Edit Cover.',
'Allow photo-library access and choose a clear image.',
'Use the requested crop: square for the logo and 16:9 for the cover.',
'Wait for upload/save completion and verify the image on Business.'
],'The stored image reference is associated with the business.','Uploads use caterer-logos and caterer-covers storage. Bucket permissions and image access are deployment-dependent; do not upload confidential business documents as public marketing images.',[A+'(caterer)/edit-profile.tsx',L+'storage.ts'],'IMPLEMENTED','Business Profile editor → logo/cover');
feature('Caterer','Submit verification documents','Provide the five document types for Staff review.',[
'In the Business Profile editor scroll to BUSINESS DOCUMENTS.',
'Upload Business Permit, Sanitary Permit, Government-issued ID, Business Registration Certificate and Proof of Address using each document control.',
'Grant photo access and choose legible document images; the mobile UI advertises JPG/PNG.',
'Wait for each upload and check Verification Progress and document status.',
'Save the business profile and inspect pending/rejected feedback through Business.'
],'Document records and storage references are available for the Staff verification queue.','The mobile uploader selects images, not a general PDF picker, although the Staff preview can render more formats. There is no verified separate Submit Application button; document upload and profile saving are the implemented workflow. Storage privacy must be validated in deployment.',[A+'(caterer)/edit-profile.tsx',web('staff/CatererVerification')],'CONDITIONAL','Business → editor → BUSINESS DOCUMENTS');
feature('Caterer','Track business approval or rejection','Determine whether public listing approval is complete.',[
'Open Business and inspect Pending Review, Verified Caterer, Rejected or Not Submitted.',
'If pending, verify the five documents are uploaded and await Staff review.',
'If rejected, review the available feedback and correct inaccurate or missing details/documents.',
'Refresh the business view after a review or correction.',
'Confirm public discovery only after verification_status is approved.'
],'The profile badge reflects the saved business verification status.','A specific resubmission/reset action after rejection is not established; replacing an image does not prove the business returned to the pending queue. Ask Staff to review the corrected application through the existing complaint/support process.',[A+'(caterer)/profile.tsx',A+'(caterer)/edit-profile.tsx'],'IMPLEMENTED','/(caterer)/profile');
feature('Caterer','Set downpayment and accepted payment preferences','Display the business’s configured payment terms.',[
'Open the Business Profile editor and find BOOKING POLICY.',
'Enter Downpayment Percentage using a valid permitted percentage.',
'Under ACCEPTED PAYMENT METHODS choose GCash, Maya, BPI Online / QR, BDO Online / QR or Credit / Debit Card as applicable.',
'Enter Payment Account Details only for accounts the business is authorized to use.',
'Keep at least one method enabled and select Save Business Profile.'
],'The business stores its downpayment percentage and displayed accepted-method preferences.','These preferences do not guarantee a channel is enabled in hosted Xendit checkout. The form defaults an empty/zero-like percentage to 25; authoritative pricing accepts only valid percentages. Existing booking totals and deposits are not repriced by editing this profile.',[A+'(caterer)/edit-profile.tsx',E+'xendit-payment/create-checkout.ts'],'IMPLEMENTED','Business Profile editor → BOOKING POLICY');
feature('Caterer','Create a menu item','Offer a separately priced menu addition.',[
'Open Menu and select the Add Item control.',
'Enter Item Name *, Category *, optional Description and Price per Guest (₱) *.',
'Select Main Course, Appetizer, Dessert or Drink.',
'Optionally enter Serving Size Overview and choose a unit, using the preview or quick serving examples.',
'Select Save and verify the new item in its category.'
],'A menu_items record is created for the current caterer.','Price is per guest; serving units such as kg, tray, tub or piece describe the portion and do not change the booking multiplier. A zero-priced add-on is supported by the pricing helper; invalid/nonfinite prices must not be used.',[A+'(caterer)/menu.tsx',L+'packagePricing.ts'],'IMPLEMENTED','/(caterer)/menu');
feature('Caterer','Edit or delete a menu item','Maintain the offered menu.',[
'Open Menu, choose the category and use the item’s edit control.',
'Update the name, category, description, per-guest price or serving information and Save.',
'To remove an item, use its delete control and inspect Delete Item.',
'Select Delete only when removal is intended, or Cancel to retain it.',
'Refresh and verify the result.'
],'The menu entry is updated or a deletion is attempted.','The delete handler does not inspect every database error before reloading; absence must be verified. The supplied booking_customizations foreign key cascades on menu deletion, so detail mirrors can disappear; stored booking quote totals must remain authoritative. No menu archive workflow is implemented.',[A+'(caterer)/menu.tsx','supabase/tests/fixtures/fixed-pricing-menu-catalog.sql'],'IMPLEMENTED','Menu → item actions');
feature('Caterer','Create a fixed-price catering package','Define an offer with clear guest bounds and inclusions.',[
'Open Packages and choose the Add Package control or Create Package.',
'Upload a cover photo if desired, choose Bronze, Silver, Gold or Premium, and enter Package Name * and Description.',
'Enter Package Price (₱) *, Included Guest Capacity *, Maximum Guests * and optional Min Guests.',
'Type dishes in FOOD MENU FOR THIS PACKAGE and use Add; select/type SERVICE INCLUSIONS and choose SUITABLE EVENT TYPES.',
'Select Create Package and inspect the saved unpublished card.'
],'A package is created with publication_status=unpublished.','Minimum must be positive and no greater than included capacity; maximum must be at least included capacity. Missing minimum means one in the shared calculator. There is no manual extra_guest_fee field. The max_guests schema/pricing migration is a required deployment dependency.',[A+'(caterer)/packages.tsx',L+'packagePricing.ts'],'CONDITIONAL','/(caterer)/packages');
feature('Caterer','Edit a package and understand the automatic extra-guest rate','Maintain future quotations.',[
'Open the package’s edit icon.',
'Update the existing fields and review Automatic rate, calculated as package price ÷ included capacity.',
'Keep minimum ≤ included capacity ≤ maximum and a positive package price.',
'Add/remove food or service chips with the available controls, then Save Changes.',
'Refresh the package card and check its publication status.'
],'The package changes are saved when ownership, status and pricing validation permit them.','The displayed rate is rounded for display only. The extra subtotal uses the full ratio before two-decimal rounding. Historical bookings retain their stored totals; editing the package is not a way to adjust an existing paid booking.',[A+'(caterer)/packages.tsx',L+'packagePricing.ts'],'CONDITIONAL','Packages → Edit');
feature('Caterer','Publish or unpublish a package','Control whether customers can make new bookings from an offer.',[
'Open Active Packages and inspect the card’s publication status.',
'Use Publish for an unpublished offer that is ready for customers.',
'Use Unpublish when an existing published offer should stop receiving new bookings.',
'Wait for the saved state and refresh to confirm it.',
'If publication setup or a stale-state error appears, retry only after reviewing the refreshed record.'
],'The publication helper records a guarded status transition.','Active Packages includes published and unpublished items. Unpublishing hides new-booking access; existing accepted bookings/history remain available to authorized participants. These controls are not event-date availability settings.',[A+'(caterer)/packages.tsx',L+'packagePublication.ts'],'IMPLEMENTED','Packages → Active Packages');
feature('Caterer','Archive and restore a package','Retire an offer while preserving referenced history.',[
'Use the Archive control on the package card.',
'Read Archive Package and confirm Archive, or Cancel.',
'Open Archived Packages to find the retired offer.',
'Use Restore as unpublished to return it to management.',
'Review it and explicitly Publish if it should become publicly bookable again.'
],'An archived package returns as unpublished when restored.','The current screen offers archive, not permanent package deletion. Archived offers can still be referenced by historical bookings and report rankings. Do not delete a package through a database tool to imitate this control.',[A+'(caterer)/packages.tsx',L+'packagePublication.ts'],'IMPLEMENTED','Packages → Archived Packages');
feature('Caterer','Set daily booking capacity','Control committed events per event date.',[
'From Dashboard Quick Actions select Availability.',
'Read Daily Booking Limit and enter a positive whole number.',
'Select Save capacity.',
'Review any validation message and the calendar’s committed counts.',
'Choose a feasible limit that is not below current/future accepted commitments.'
],'max_bookings_per_day is updated if authorized and compatible with existing commitments.','This is separate from the subscription monthly quota. Confirmed, awaiting_payment, paid, ongoing and completed count as committed; pending/rejected/cancelled do not. Server guards, not a displayed count alone, prevent overbooking.',[A+'(caterer)/availability.tsx',L+'availability.ts'],'CONDITIONAL','Dashboard → Availability');
feature('Caterer','Block or reopen an event date','Manage date availability without cancelling existing events.',[
'Open Availability and navigate to the desired calendar month.',
'Select today or a future date and inspect its committed count.',
'Choose Mark as Unavailable and confirm Mark unavailable, or Make Date Available and confirm Make available.',
'Refresh and inspect the date’s status.',
'Handle any existing booking individually if a separate cancellation is necessary.'
],'The date is blocked or reopened subject to daily capacity.','Blocking prevents new requests/confirmations but does not cancel existing commitments. Reopening a date does not create extra capacity if it is already full. Dates follow Philippine Standard Time in this module.',[A+'(caterer)/availability.tsx',L+'availability.ts'],'CONDITIONAL','Availability → calendar date');
feature('Caterer','Review incoming requests and customer event details','Decide whether the business can accommodate an event.',[
'Open Bookings and choose a Pending request or Review & Respond.',
'Inspect Booking Summary, CUSTOMER DETAILS, package, date/time, guest count, event type, venue and special requests.',
'Review FINANCIAL BREAKDOWN and the required downpayment.',
'Check both daily availability and Monthly accepted bookings before committing.',
'Use Open Client Chatroom if clarification is needed.'
],'The assigned booking is displayed with relevant event and customer information.','Personal details are for servicing the booking, not public distribution. A pending request is not a slot reservation. Backend publication, suspension and quota rules may reject confirmation even when the old card still appears eligible.',[catb,L+'availability.ts',L+'monthlyBookingQuota.ts'],'IMPLEMENTED','/(caterer)/bookings');
feature('Caterer','Confirm or reject a pending request','Respond to a customer’s proposed event.',[
'Open the pending request’s management actions.',
'Select Confirm Booking Request only after checking capacity and package availability.',
'Alternatively select Reject Booking, enter Reason for Rejection * and choose Submit Rejection.',
'Wait for the update and refresh the request.',
'If Monthly booking limit reached appears, leave the request pending and review Plans & Billing or a later acceptance period.'
],'The booking becomes confirmed or rejected if the server accepts the transition.','Rejection requires a reason. Confirmation does not verify a payment. The server can reject full/blocked dates, hidden packages, suspension or quota exhaustion; do not bypass these controls.',[catb,'supabase/proposals/monthly_booking_quota_EXECUTE.sql','supabase/proposals/package_publication_EXECUTE.sql'],'IMPLEMENTED','Booking Summary → MANAGEMENT ACTIONS');
feature('Caterer','Progress an event to ongoing and completed','Maintain the event lifecycle.',[
'Open an eligible paid booking.',
'When the event is actually taking place, select Mark Event as Ongoing.',
'After service is completed, select Mark Event as Completed on the eligible ongoing booking.',
'Refresh and confirm the new status.',
'Review customer feedback later if submitted.'
],'The saved lifecycle can advance through paid → ongoing → completed.','Use only actions offered for the current state. No automatic date-based event completion was established. Do not use these actions to manufacture payment evidence or alter historical amounts.',[catb],'IMPLEMENTED','Booking Summary → MANAGEMENT ACTIONS');
feature('Caterer','Monitor verified booking deposits','Read payment evidence without a second Xendit approval.',[
'Open a paid/eligible booking and inspect Verified Downpayment E-Receipt.',
'Read Payment Channel, the displayed amount, Payment Status, Verified Timestamp and Transaction Reference.',
'Cross-check the booking/customer and stored reference if investigating a discrepancy.',
'Refresh before treating a pending or confirmed-only booking as paid.',
'Report unresolved provider/database mismatches through authorized support channels.'
],'Server-recorded deposit evidence is displayed.','The e-receipt is an application summary, not a bank settlement statement. Xendit success is processed server-side automatically; there is no need for Staff approval afterward. Channel labels on booking screens may use stored preference data; subscription method normalization is separate.',[catb,E+'xendit-webhook/verify-booking-invoice.ts'],'IMPLEMENTED','Booking Summary → Verified Downpayment E-Receipt');
feature('Caterer','Message a customer and inspect their booking profile','Coordinate authorized event details.',[
'Choose Open Client Chatroom on a booking, or open its Messages thread.',
'Send text, photo or emoji content using the shared chat controls described in Chapter 2.',
'Tap the customer avatar or displayed name in the conversation header.',
'Read Customer Profile, Phone number, Address and Email address; use Try again if loading fails.',
'Close the profile modal to return to the same conversation.'
],'The chat and a profile modal for the booking customer are displayed when authorized.','The current header exposes avatar/name actions; no separate user-round profile icon is present. The modal checks booking participation, then directly queries profiles under RLS. The separate narrow profile RPC helper is not wired into this component; its proposal alone does not establish deployed privacy.',[S+'ChatScreen.tsx',M+'components/ConversationCustomerProfile.tsx',L+'bookingConversationProfile.ts'],'CONDITIONAL','Booking conversation → customer avatar/name');
feature('Caterer','Save private Internal Notes','Record operational reminders for an assigned booking.',[
'Open Booking Summary and find Internal Notes.',
'Read Private — Only visible to your catering team. and wait for the saved note to load.',
'Enter up to 5,000 characters and select Save Notes.',
'To remove the content, select Clear and then Save Notes.',
'If Notes changed elsewhere appears, preserve/copy your draft as needed and reload the saved note before retrying.'
],'The private-note RPC stores the note and advances its revision.','The supported team identity is the assigned caterer account, not a separate multi-employee team system. Reload can replace unsaved drafts. Internal notes are separate from customer-visible bookings.caterer_notes and are not put into customer booking payloads.',[M+'components/BookingInternalNotes.tsx',L+'bookingInternalNotes.ts','supabase/proposals/booking_internal_notes_EXECUTE.sql'],'IMPLEMENTED','Booking Summary → Internal Notes');
feature('Caterer','Use emergency cancellation','Cancel an eligible accepted event when unavoidable.',[
'Open a confirmed or paid booking and choose Emergency Cancellation.',
'Select the emergency reason or provide the custom explanation.',
'Read the consequences, including the verified-deposit refund obligation.',
'Select Confirm Cancel & Notify Client, or Back to abandon cancellation.',
'Refresh the cancelled record and follow the refund-transfer process if money is due.'
],'The application attempts a guarded cancellation and records a pending refund for the verified downpayment when applicable.','The current client calculates a full verified-downpayment refund for caterer cancellation and re-reads eligibility before writing. This is not an automatic wallet transfer. A missing customer refund destination prevents proof submission until resolved.',[catb],'CONDITIONAL','Booking Summary → Emergency Cancellation');
feature('Caterer','Transfer a refund and submit proof','Provide evidence after returning money to the customer.',[
'Open the cancelled booking and inspect the amount, destination and refund deadline.',
'Transfer the required amount to the verified customer destination through the external wallet/bank.',
'In REFUND TRANSFER & PROOF enter Transfer reference number * (5–200 characters).',
'Select a receipt/screenshot and choose Submit Transfer Proof for Verification.',
'Refresh and wait for awaiting_customer_confirmation; the customer must confirm actual receipt.'
],'submit-refund-proof can save a unique evidence submission and move the obligation to customer confirmation.','The protected Edge endpoint is called but its source is not present locally. Proof is only submitted for eligible pending/overdue refunds with a destination. Late proof is recorded as late. If the network fails after submission, refresh before retrying; the app retains the uploaded proof after a possibly committed attempt.',[catb,'supabase/metadata/refund_transfer_submissions_metadata.json'],'CONDITIONAL','Cancelled booking → REFUND TRANSFER & PROOF');
feature('Caterer','Respond to a missing-refund report','Record an investigation update for the customer.',[
'Open Bookings → Refund Disputes and select View Details.',
'Read Customer Report, refund amount, destination, evidence reference and proof status.',
'Enter Investigation Response using 10–2,000 characters.',
'Select Save Investigation Update.',
'Confirm the saved response and continue coordinating corrective action without declaring receipt for the customer.'
],'The app calls caterer_respond_to_refund_dispute and displays the saved result.','The exact deployed RPC body is not supplied. This response does not itself process a refund or replace customer confirmation. Never claim funds arrived solely because a transfer receipt exists.',[catb],'CONDITIONAL','Bookings → Refund Disputes');
feature('Caterer','Read and reply to customer reviews','Acknowledge feedback professionally.',[
'Open a completed booking that has CUSTOMER REVIEW.',
'Read the four ratings and comment.',
'Select Reply to Review, enter a professional response and choose Send Reply.',
'Wait for Reply sent successfully! and refresh the booking.',
'Check the response shown to customers on the public review display.'
],'The caterer_reply field is updated when permitted.','A reply is not a change to the customer’s rating. The form requires nonblank text; no customer-review deletion or moderation power is offered to caterers.',[catb,A+'(tabs)/caterer/[catererId].tsx'],'IMPLEMENTED','Completed booking → CUSTOMER REVIEW');
feature('Caterer','Read Reports & Analytics','Review booking activity with clearly separated financial definitions.',[
'From Dashboard choose Reports & Analytics.',
'Select This Month, Last Month, This Year or Custom Date Range.',
'For a custom range, enter YYYY-MM-DD start/end and choose Apply Date Range; use at most 366 inclusive days.',
'Read Booking statistics, Monthly booking trends, Popular packages and Financial analytics.',
'Use the refresh icon, pull-to-refresh or Retry when needed.'
],'The screen loads the owner-authorized report RPC and a separate read-only recorded-downpayment query.','CONDITIONAL on get_caterer_reports and current RLS. Booking metrics use created_at; downpayments use payment_verified_at. Verified Downpayments Received sums required deposit amounts for paid/ongoing/completed records with references; it is not an independent cash ledger. Settled refunds is Unavailable. The chart shows five months ending at the range end; zeros outside a narrow filter do not prove no lifetime bookings.',[A+'(caterer)/reports.tsx',L+'catererReports.ts','supabase/proposals/caterer_reports_EXECUTE.sql'],'CONDITIONAL','/(caterer)/reports');
feature('Caterer','Read monthly usage and plan limits','Understand acceptance limits separately from pending requests.',[
'Open Dashboard, Bookings or Plans & Billing where Monthly accepted bookings is displayed.',
'Read used, limit, remaining and the YYYY-MM Asia/Manila period.',
'Use the small refresh icon to reload authoritative booking usage.',
'If setup required/unavailable appears, contact the project operator rather than estimating from all requests.',
'Review the plan before confirming another pending request.'
],'The display counts committed bookings assigned to the current quota_month.','Pending/rejected requests do not count. Completed bookings retain their quota period; cancellation releases that booking’s quota. An expired paid plan uses the Free monthly limit in the helper. Only server checks authorize acceptance; purchasing a plan does not erase actual accepted usage.',[M+'components/MonthlyBookingQuotaSummary.tsx',L+'monthlyBookingQuota.ts'],'CONDITIONAL','Dashboard/Bookings/Plans & Billing');
feature('Caterer','Choose a subscription and purchase through Xendit','Purchase the selected paid plan.',[
'Open Business → Subscription Plan or choose Upgrade on Dashboard.',
'In Plans & Billing review Free, Basic, Standard and Premium, current usage and expiry.',
'Choose Upgrade to the desired paid plan, then inspect Complete Subscription.',
'Select an available payment method and choose Pay ₱… via the displayed channel.',
'Complete hosted checkout and wait for Subscription Activated or Payment Processing; reopen and refresh if confirmation is pending.'
],'An authenticated, provider-verified payment can call activate_paid_subscription and save a confirmed subscription receipt and matching plan.','Prices shown are Free ₱0, Basic ₱299, Standard ₱499 and Premium ₱999; the server validates against subscription_plans.price. No Staff approval is needed after verified Xendit success. Do not pay twice while pending. Provider channel availability remains configuration-dependent.',[S+'SubscriptionScreen.tsx',E+'xendit-payment/create-checkout.ts',E+'xendit-webhook/verify-subscription-payment.ts'],'CONDITIONAL','Business → Subscription Plan modal');
feature('Caterer','Read expiry and subscription payment history','Verify the saved entitlement and receipts.',[
'Open Plans & Billing and inspect CURRENT PLAN and the displayed expiry/Renews date.',
'Expand Payment History.',
'Review each saved plan, amount, timestamp, payment method and status.',
'After a verified purchase, refresh and confirm that the expected receipt and plan appear.',
'If the plan and confirmed receipt disagree, report the reference through the authorized support process without repurchasing.'
],'The screen reads existing subscription_payments and caterer entitlement state.','The existing RPC sets expiry to processing time + 30 days. It does not add unused time to a previous expiry or establish recurring auto-debit. Duplicate delivery does not extend expiry. Historical online method values remain unchanged; new verified method detail depends on the deployed webhook and provider fields.',[S+'SubscriptionScreen.tsx','supabase/metadata/xendit_subscription_catalog_export.txt',E+'xendit-webhook/verify-subscription-payment.ts'],'IMPLEMENTED','Plans & Billing → Payment History');
feature('Caterer','Use support, notifications and logout','Maintain account awareness and end the session safely.',[
'Open Business → Help Center / FAQ for searchable Caterer questions.',
'Open Notifications from Business or Dashboard; read and refresh notices or select Mark all read.',
'Use File a Complaint → New Complaint to report a customer/platform issue with type, description and priority.',
'After submitting, review My Complaints and Staff Resolution.',
'Use Business → Log Out and confirm Log Out when finished.'
],'Support records, in-app notices and session state are updated through their respective screens.','No consultation inbox or Staff chat route exists in the current mobile navigator. Signout does not cancel events or remove refund obligations. Notification deep links require device validation; use the main tabs if a link opens incorrectly.',[A+'(caterer)/profile.tsx',A+'(caterer)/complaints.tsx',S+'FAQScreen.tsx',S+'NotificationsScreen.tsx'],'IMPLEMENTED','Business → support menu');
shot('3.1','Caterer Dashboard and quick actions','Caterer','/(caterer)','Show verification state, usage and action cards with test data.');
shot('3.2','Business verification documents','Caterer','Business Profile editor','Show all five document types using redacted demonstration documents.');
shot('3.3','Package pricing and publication controls','Caterer','Packages','Show minimum/included/maximum fields, automatic rate and published/unpublished/archived states.');
shot('3.4','Menu item editor and serving description','Caterer','Menu → Add Item','Show per-guest price separately from serving units.');
shot('3.5','Availability and daily capacity','Caterer','/(caterer)/availability','Show blocked/full/open dates and committed counts.');
shot('3.6','Booking management and private notes','Caterer','Booking Summary','Use a test event; show actions and private-note save/clear controls.');
shot('3.7','Caterer refund proof and investigation response','Caterer','Bookings → refund/dispute details','Redact account numbers and show the customer-confirmation requirement.');
shot('3.8','Plans & Billing and payment history','Caterer','Business → Subscription Plan','Show tier limits, expiry and a verified synthetic receipt; redact references.');
shot('3.9','Reports & Analytics metric definitions','Caterer','/(caterer)/reports','Capture the current financial caveats and date bases, not an invented revenue chart.');
shot('3.10','Customer profile in a booking conversation','Caterer','Booking chat → avatar/name','Use a consented test profile and missing-field example.');
ch(4,'The Staff portal is an operational workspace, not a payment-disbursement console. Use the issued Staff account at the project-provided portal URL. The sidebar contains Dashboard, Caterer Verification, Subscriptions, Complaints, Booking Monitor, Account Monitoring and Refund Management.');
feature('Platform Staff','Sign in and understand portal access','Enter the authorized Staff workspace.',[
'Open the supplied portal URL and /login.',
'Enter Email Address and Password; use the eye control if necessary.',
'Select Sign In and wait for the authoritative profile-role/status check.',
'On success, verify Staff Portal and the assigned account name in the sidebar.',
'If Access denied or suspension is shown, contact the administrator; do not create a public account to obtain Staff access.'
],'An authorized staff profile opens /staff.','The login is shared by Staff and Admin; Customer/Caterer roles are signed out of this portal. Forgot password? is an inactive text/control in the inspected page; no portal reset procedure is documented.',[web('Login'),W+'App.tsx',W+'lib/auth.ts'],'IMPLEMENTED','/login → /staff');
feature('Platform Staff','Review Dashboard queues','Prioritize visible platform work.',[
'Open Dashboard.',
'Read Pending Verifications, Open Complaints, Total Bookings and Pending Refunds.',
'Select Access Queue on the relevant Quick Operations card.',
'Review Verification Breakdown and Recent Operations for context.',
'Open the destination record to verify its actual state before taking action.'
],'Queue counts and links help locate operational records.','No assignment/claiming system for individual Staff tasks was found. Process Refunds/Manage and disburse wording on a Dashboard card is misleading: it opens read-only refund monitoring and does not give Staff transfer authority.',[web('staff/Dashboard'),web('staff/RefundManagement')],'IMPLEMENTED','/staff');
feature('Platform Staff','Inspect a caterer application and documents','Evaluate business identity and submitted credentials.',[
'Open Caterer Verification and choose Pending Queue, Approved or Rejected.',
'Select the business application from the list.',
'Review Vendor Metadata, contact details, business overview and Compliance Clearances.',
'Select Audit File for each available document and wait for its preview.',
'Use Open in Tab or Download file directly only when necessary and handle the file privately.'
],'The selected application and accessible document preview are displayed.','Five required document types are listed, but the UI count is not a legal authenticity check. The preview attempts a one-hour signed URL then can fall back to the stored URL; private bucket configuration must be checked before claiming universal document confidentiality.',[web('staff/CatererVerification')],'IMPLEMENTED','/staff/verification');
feature('Platform Staff','Approve a business verification application','Record the verification decision after review.',[
'Select the pending application and inspect all required credentials.',
'Enter Internal Operations Notes if needed.',
'Select Approve & Grant Free Tier only after the review is complete.',
'Wait for the application list to reload.',
'Open Approved and verify the saved business state.'
],'The handler writes approved verification status, review actor/time and notes.','Despite the button label, updateStatus does not explicitly assign or reset subscription_plan. Do not claim approval converts a paid plan to Free. Internal Operations Notes privacy depends on field grants/RLS, not the word Internal alone. No per-document approve action was verified.',[web('staff/CatererVerification')],'IMPLEMENTED','/staff/verification → application');
feature('Platform Staff','Reject an application with feedback','Explain a verification refusal.',[
'Open the application and choose Reject Application.',
'Enter Rejection Rationale (Visible to Vendor) * with clear corrective guidance.',
'Confirm the rejection using the displayed confirmation control.',
'Verify the application appears in Rejected after reload.',
'Review corrected submissions through the available queue; coordinate any reset/resubmission that the current UI does not automate.'
],'The handler saves rejected status, rejection_reason, staff_notes and reviewer/time.','A nonblank rejection reason is required. The page says feedback is transmitted, but the handler has no direct email call; notification delivery depends on backend behavior not established here.',[web('staff/CatererVerification')],'IMPLEMENTED','/staff/verification');
feature('Platform Staff','Inspect and prioritize general complaints','Review user-reported service/platform issues.',[
'Open Complaints.',
'Choose All Tickets, Open, In Review, Resolved or Closed.',
'Select a ticket and read Reporter, Respondent / Against, Incident Description and existing findings.',
'Under Adjust Priority Level select low, medium or high as appropriate.',
'Reopen/refresh the ticket to verify the stored priority.'
],'The complaint’s priority can be updated.','The respondent is a reported name, not necessarily a verified relationship to a specific booking. This page does not create a money transfer or alter a booking payment. Some writes do not surface errors fully, so verify persisted changes.',[web('staff/Complaints')],'IMPLEMENTED','/staff/complaints');
feature('Platform Staff','Update a complaint investigation or resolution','Record findings and ticket state.',[
'Select the complaint and enter Resolution Log & Findings.',
'Use Mark In Review while investigating.',
'After documenting the outcome, use Mark Resolved when appropriate.',
'Use Close Ticket only when the issue should be closed.',
'Refresh and verify the stored status and notes visible through authorized complaint history.'
],'The complaint record is updated with resolution_notes, status and updated_at.','There is no verified evidence-upload inbox or built-in Staff/user live chat attached to this page. This is general complaint management, distinct from read-only refund dispute monitoring. A success-looking screen alone should not be treated as proof if a write was denied.',[web('staff/Complaints')],'IMPLEMENTED','/staff/complaints → ticket');
feature('Platform Staff','Monitor bookings without altering them','Inspect platform booking activity.',[
'Open Booking Monitor.',
'Select a status filter, including Awaiting Payment if required.',
'Search by customer or caterer name.',
'Open a booking row to read Booking Detail Overview, parties, venue, event date/time, guests, total and downpayment.',
'Use Close View to return to the ledger.'
],'Authorized booking records and their current status are displayed.','The screen is read-only; no Staff confirm/reject/paid/refund action is offered. Total Value Shown sums displayed booking values, not money received. The page says real time but primarily loads on state changes; reload to verify fresh information.',[web('staff/BookingMonitor')],'IMPLEMENTED','/staff/bookings');
feature('Platform Staff','Monitor refund submissions, disputes and tracking','Inspect refund progress and evidence.',[
'Open Refund Management; the page heading is Refund Monitoring.',
'Choose Refund Submissions, Refund Disputes or Refund Tracking.',
'Use the available status filters and search to find a case.',
'Select View evidence, View dispute or View tracking.',
'Read the destination, amount, receipt reference, customer report and caterer response; use Open receipt (10-minute signed URL) only when access is authorized.'
],'An authorized read-only refund activity detail is displayed.','Staff cannot approve/execute a transfer or mark actual receipt on this screen. Existing review/staff notes are historical display fields. Private proof access errors require authorized configuration review, not bypassing storage permissions. Overlapping disputed/obligation metrics must not be added as separate money totals.',[web('staff/RefundManagement')],'IMPLEMENTED','/staff/refunds');
feature('Platform Staff','Monitor plans, renewals and payment history','Review subscriptions without manual Xendit payment approval.',[
'Open Subscriptions.',
'Use Caterer Plans and search/filter the business or plan.',
'Review current plan, expiration and Monthly Bookings.',
'Open Renewals for expired or within-seven-days subscriptions.',
'Open Payment History to inspect saved subscription receipts and references.'
],'The page displays caterer plans, renewal queues and subscription payment records.','Payments are automatically verified by the server. This screen does not authorize Staff to create a confirmed payment or award arbitrary free paid time. Hardcoded displayed plan prices can become stale relative to the authoritative plan table.',[web('staff/SubscriptionManager')],'IMPLEMENTED','/staff/subscriptions');
feature('Platform Staff','Send a subscription reminder','Notify a caterer about renewal when the secure RPC exists.',[
'Open Subscriptions → Renewals.',
'Select the relevant expired/expiring business.',
'Choose Notify Caterer once.',
'Read Reminder sent or the returned secure-RPC/setup error.',
'If delivery is uncertain, inspect authorized notifications/history before repeating.'
],'staff_send_subscription_reminder is invoked for the selected caterer.','CONDITIONAL: the original deployed function body and delivery semantics are not available locally. No email/SMS or recurring reminder scheduler is established by this caller.',[web('staff/SubscriptionManager')],'CONDITIONAL','/staff/subscriptions → Renewals');
feature('Platform Staff','Correct a subscription from an existing confirmed payment','Repair a mismatched entitlement using verified evidence.',[
'In Caterer Plans select Manage Plan for the relevant business.',
'Review the restriction requiring an existing confirmed Xendit payment.',
'Choose the matching paid plan and enter Confirmed Payment Reference.',
'Enter Reason for Correction using at least ten characters and submit the correction control.',
'Verify the saved plan and the corresponding audit entry through authorized records.'
],'staff_correct_subscription_plan can restore the term associated with a matching confirmed receipt.','The original exported RPC requires Staff/Admin, correct caterer/plan, enough payment amount, an unexpired 30-day period and a reason; it prevents reuse for another correction. Expiry comes from the receipt time, not correction time. This is exceptional repair, not a required approval stage for normal Xendit purchases.',[web('staff/SubscriptionManager'),'supabase/metadata/xendit_subscription_catalog_export.txt'],'CONDITIONAL','/staff/subscriptions → Manage Plan');
feature('Platform Staff','Review account warnings and audit history','Assess cancellation patterns before moderation.',[
'Open Account Monitoring.',
'Filter Customer/Caterer and All, Warning, Flagged or Suspended; search by name, business, email or ID.',
'Read Cancellations (90d), Lifetime Cancels, Total Bookings and Refund Disputes.',
'Use the history control to show Recent Staff Audit History.',
'Review context before starting a flag or suspension.'
],'staff_account_monitoring_list and account_monitoring_events supply visible operational context.','Warnings are advisory: five or more cancellations in 90 days trigger a warning; ten or more show a higher warning. No automatic suspension from a warning count is established. History is limited to 30 recent actions for the selected account.',[web('staff/AccountMonitoring')],'CONDITIONAL','/staff/account-monitoring');
feature('Platform Staff','Flag, unflag, suspend or reactivate an account','Apply an authorized, reason-recorded moderation action.',[
'Select the appropriate account action in Account Monitoring.',
'Read the confirmation identifying the account and requested action.',
'Enter a reason of at least ten characters describing evidence/context.',
'Confirm the action and wait for the secure RPC result.',
'Refresh the record and history; if denied, stop and resolve permissions rather than writing profile fields directly.'
],'staff_account_monitoring_action is called with the target, action and reason.','Backend authorization/auditing must be installed. Suspended mobile users may lose access to the platform at login, including refund-support access; preserve an approved external support process. Do not suspend solely from the advisory warning count.',[web('staff/AccountMonitoring'),L+'auth.ts'],'CONDITIONAL','/staff/account-monitoring → account action');
feature('Platform Staff','Sign out and recognize unavailable Staff features','End access without assuming nonexistent controls.',[
'In the sidebar select Sign out.',
'Select Confirm to finish or Cancel to remain signed in.',
'Confirm the session ends before another person uses the browser.',
'For profile/password changes, consultation requests or Staff-specific notification management, use the administrator’s approved process rather than looking for an undocumented page.'
],'The Supabase session is signed out.','Current Staff routes do not include Consultation inbox, Staff profile/settings or a Staff notifications page. No per-Staff task assignment, payment-disbursement control or dedicated Staff report export was verified.',[W+'components/Sidebar.tsx',W+'App.tsx'],'IMPLEMENTED','Staff sidebar → Sign out');
shot('4.1','Staff portal login and Dashboard','Platform Staff','/login; /staff','Hide credentials; show the actual operational queues.');
shot('4.2','Application audit and verification decision','Platform Staff','/staff/verification','Redact document numbers and show rejection rationale or approval control.');
shot('4.3','Complaint investigation and resolution controls','Platform Staff','/staff/complaints','Use an approved synthetic ticket and show all four status filters.');
shot('4.4','Read-only booking and refund monitoring','Platform Staff','/staff/bookings; /staff/refunds','Show that viewing evidence is not a refund or payment approval.');
shot('4.5','Subscription correction and account monitoring','Platform Staff','/staff/subscriptions; /staff/account-monitoring','Use synthetic references; include reason fields and audit history.');
ch(5,'Only an authorized Administrator account can enter /admin. Administrators can also enter the operational /staff routes, but their sidebar continues to show administrator navigation. Use those exact routes or Dashboard links when performing Staff-equivalent procedures.');
feature('Administrator','Sign in and inspect the administrative Dashboard','Review platform-wide operational indicators.',[
'Open the portal /login with the administrator account.',
'Enter Email Address and Password and select Sign In.',
'Confirm the Admin Portal sidebar and /admin Dashboard.',
'Read Total Users, Registered Caterers, Total Bookings and Total Revenue.',
'Use Action Center, Subscription Tiers or View Directory to inspect the underlying records.'
],'An authorized admin profile opens the administrative workspace.','Total Revenue is based on confirmed subscription payments, not all customer booking value or independently reconciled net cash. A route-level role check does not replace database authorization. Suspended profiles cannot sign in normally.',[web('Login'),web('admin/Dashboard'),W+'App.tsx'],'IMPLEMENTED','/admin');
feature('Administrator','Browse accounts and inspect role-specific details','Review the user directory without changing account roles.',[
'Open User Management.',
'Choose All, Customer, Caterer, Staff or Admin and use the name/email/business search.',
'Select Profile on an account.',
'Read email, user ID, joined date and, for caterers, Vendor Profile details.',
'Close the profile view when finished.'
],'The selected account and available business metadata are displayed.','No general customer-to-staff conversion control exists in this directory. View counts are subject to query access/API limits. Personal data should be used only for authorized operations.',[web('admin/UserManagement')],'IMPLEMENTED','/admin/users');
feature('Administrator','Handle account suspension and reactivation restrictions','Recognize the directory action and the audited moderation path.',[
'Inspect an account’s current status in User Management.',
'If an offered Suspend/Reactivate action is appropriate, read its confirmation before proceeding.',
'Confirm only under the approved moderation process and inspect the returned status.',
'If Failed to update account status appears, stop; do not bypass the database trigger.',
'For the reason-required audited workflow, open /staff/account-monitoring and follow Chapter 4.'
],'An allowed status change is confirmed by a returned profile record; blocked changes show an error.','The directory writes profiles.status directly and does not collect a reason. Existing suspension triggers can block direct reactivation. Prefer the installed reason/audit RPC workflow; do not claim all directory changes create moderation audit events.',[web('admin/UserManagement'),web('staff/AccountMonitoring')],'CONDITIONAL','/admin/users; /staff/account-monitoring');
feature('Administrator','Create a new Staff account securely','Provision a separate privileged identity without converting a customer/caterer.',[
'Open Platform Settings and select Add Staff Account.',
'Enter Full Name, an unused Email Address, Password (min 12 characters) and Confirm Password.',
'Use matching passwords, with no more than 72 UTF-8 bytes.',
'Submit Create Staff Account and wait for confirmed creation.',
'Verify the new Staff row and communicate credentials privately through the institution-approved channel; the Staff member signs in at the standard portal login.'
],'create-staff-account verifies an active administrator, creates a new initially banned Auth user, finalizes Staff authorization and then activates that new identity.','CONDITIONAL on deployed endpoint, origin configuration and cc_staff_provision1_finalize. Existing email accounts cannot be converted. If creation/finalization/activation is unconfirmed, check with the project owner; never blindly retry and create duplicate identities. No forced password-change UI is verified.',[web('admin/PlatformSettings'),W+'lib/staffProvisioning.ts',E+'create-staff-account/handler.ts',E+'create-staff-account/index.ts'],'CONDITIONAL','/admin/settings → Add Staff Account');
feature('Administrator','Manage roles of existing Staff/Admin accounts','Adjust already privileged accounts through the narrow role RPC.',[
'Open Platform Settings → Staff & Admin Accounts.',
'Select the permitted role control for another existing Staff/Admin account.',
'Choose Platform Staff or System Administrator as authorized.',
'Wait for the confirmed role response and review any error.',
'Verify the displayed account role and require a refreshed session for access testing.'
],'cc_profile_role1_assign_staff_role can record the authorized role assignment.','The UI lists existing Staff/Admin profiles and prevents editing the signed-in administrator. The reviewed RPC also requires an active administrator and blocks self changes/business-account conversion, but its target-role scope is broader than the current screen. Do not infer an exhaustive backend prohibition from the UI list. No ordinary customer-to-Staff conversion procedure is offered or documented.',[web('admin/PlatformSettings'),W+'lib/profileRoles.ts','supabase/proposals/profiles_role_protection_EXECUTE.sql'],'CONDITIONAL','/admin/settings → Permissions');
feature('Administrator','Review configured subscription tiers','Read published configuration information without editing pricing.',[
'Open Platform Settings.',
'Scroll to Subscription Tiers Configuration.',
'Compare Free, Basic, Standard and Premium prices, package limits and booking limits.',
'Cross-check a purchase discrepancy with the authorized subscription ledger.',
'Refer configuration changes to the project’s database/development change process.'
],'The current hardcoded tier summary is displayed.','There is no plan-price editor on this page. The server plan table controls accepted payment amounts, so displayed constants must be kept aligned by developers. Do not change expiry, quotas or price records manually while investigating a payment.',[web('admin/PlatformSettings'),E+'xendit-payment/create-checkout.ts'],'IMPLEMENTED','/admin/settings');
feature('Administrator','Review subscription revenue and the payment ledger','Inspect confirmed subscription receipts separately from booking values.',[
'Open Revenue.',
'Read Total Revenue, This Month, This Week and Total Payments.',
'Review Tier Distribution for approved caterers.',
'Filter Payment Ledger by plan and inspect amount, gateway, reference and timestamp.',
'Use authorized provider records for any settlement reconciliation outside this screen.'
],'The page summarizes loaded confirmed subscription_payments.','This Month is implemented as a rolling 30-day window; This Week is rolling seven days. They are not calendar month/week accounting periods. API limits may restrict unpaginated reads; the ledger is not proof of complete audited cash flow or booking income.',[web('admin/Revenue')],'IMPLEMENTED','/admin/revenue');
feature('Administrator','Export system reports to CSV','Download the loaded report snapshot.',[
'Open Reports.',
'Select Booking Report, User Directory Report, Revenue Report or Complaint & Ticket Report.',
'Inspect the Live Preview Snapshot and loaded count.',
'Choose Export to CSV and save the file to an approved location.',
'Check the downloaded rows and redact personal information before sharing.'
],'The browser downloads caterconnect_[type]_[date].csv for the loaded records.','Each report query is limited to the latest 200 records; this is not a full database export. Revenue uses confirmed subscription payments. Nested objects are flattened one level. CSV content is not protected by RLS after download; review untrusted cell content before opening in a spreadsheet.',[web('admin/Reports')],'IMPLEMENTED','/admin/reports');
feature('Administrator','Filter activity and inspect moderation audit details','Review available recorded activity.',[
'Open Activity Logs and select a category.',
'Set From date, To date, Staff member and Moderation action when appropriate.',
'Use Search loaded records and Affected user role (loaded) for local filtering.',
'Open Details to inspect the selected activity; use available further-loading controls if shown.',
'Use Clear filters to reset and verify the date order if the screen reports an invalid range.'
],'The page combines activity sources and moderation events according to available access.','Date/Staff/action filters are database filters; text and affected-role filters are applied to loaded records. Some registration/booking/payment activity is synthesized from entity records, not a durable log of every change. No full audit of every application operation is established.',[web('admin/ActivityLogs')],'IMPLEMENTED','/admin/activity');
feature('Administrator','Inspect per-user moderation history','Review reason-recorded account actions.',[
'Open /staff/account-monitoring as an administrator, or use relevant moderation entries in Activity Logs.',
'Locate the Customer/Caterer account.',
'Open its history control and read the recorded action, reason and timestamp.',
'Cross-check the actor/context in Activity Logs details when available.',
'Use the history only for authorized investigations.'
],'Recent account_monitoring_events for the selected account are displayed when authorized.','The per-user panel loads at most 30 recent actions. It is not an all-inclusive payment/refund history and does not establish a reason for direct unaudited directory writes.',[web('staff/AccountMonitoring'),web('admin/ActivityLogs')],'CONDITIONAL','/staff/account-monitoring');
feature('Administrator','Review verification, bookings, complaints and refund operations','Use the operational pages with administrator authorization.',[
'From Dashboard use the relevant Action Center link, or open /staff/verification, /staff/bookings, /staff/complaints or /staff/refunds.',
'Follow the matching Staff procedure in Chapter 4.',
'Apply the same evidence, reason and privacy standards.',
'Return to /admin to use administrative reporting or account tools.'
],'Administrators can access the operational routes allowed to Staff/Admin.','The administrator sidebar may remain visible while an operational route is open. Admin role does not create a refund-disbursement/receipt-confirmation button or remove payment evidence requirements.',[W+'App.tsx',web('admin/Dashboard')],'IMPLEMENTED','/staff/* authorized routes');
feature('Administrator','Enable or disable maintenance','Communicate maintenance and control the mobile gate through the existing workflow.',[
'Open Maintenance & Security and read current Maintenance Status.',
'Enter a Maintenance message of 10–500 characters and Reason for change of 5–500 characters.',
'Optionally set Estimated restoration when enabling maintenance.',
'Choose Enable Maintenance or Disable Maintenance and confirm the action.',
'Refresh the saved state and Maintenance Audit History; test mobile recovery using the approved demonstration environment.'
],'set_maintenance_mode is called and the mobile gate reads the resulting flag.','The current mobile gate checks at launch, foreground and roughly every 30 seconds, and restricts access if settings cannot be read. The portal success notice says operations are not automatically blocked, while the current mobile gate does block navigation: this discrepancy is documented. Do not infer that all server jobs or every backend operation stops. Existing maintenance SQL includes deadline handling; use only the reviewed installed workflow.',[web('admin/MaintenanceSecurity'),M+'components/MaintenanceGate.tsx','supabase/metadata/caterer_booking_schema_metadata.json'],'CONDITIONAL','/admin/maintenance-security');
feature('Administrator','Read system health and security summaries','Inspect the limited diagnostics available.',[
'Open Maintenance & Security and choose Refresh.',
'Read Database Connection and Last checked.',
'Review Security Overview for recent Staff account moderation events.',
'Review Maintenance Audit History and the recorded reason/administrator/time.',
'Escalate errors through the authorized technical process; do not expose credentials or private evidence in screenshots.'
],'The page displays a settings-query connectivity result, up to ten moderation events and up to fifteen maintenance audit entries.','This is not a full uptime monitor, failed-login log, vulnerability scanner or threat-detection service. No dedicated Admin profile/password settings page was found.',[web('admin/MaintenanceSecurity')],'IMPLEMENTED','/admin/maintenance-security');
feature('Administrator','Sign out of the administrative portal','Protect privileged browser access.',[
'Select Sign out in the sidebar.',
'Confirm to end the session or Cancel to remain signed in.',
'Verify the login screen before leaving the workstation.',
'Store any authorized exported reports securely and close private document previews.'
],'The administrative session is signed out.','Signout does not remove downloaded CSVs, cached screenshots or files outside the portal. Account deletion, MFA setup and self-service password change are not implemented administrative pages in this source.',[W+'components/Sidebar.tsx',W+'App.tsx'],'IMPLEMENTED','Admin sidebar → Sign out');
shot('5.1','Administrator Dashboard and User Directory','Administrator','/admin; /admin/users','Use test accounts and redact real identifiers.');
shot('5.2','New Staff provisioning form','Administrator','/admin/settings','Show field labels, password rules and no existing-account conversion. Never show a password.');
shot('5.3','Revenue and loaded CSV report snapshot','Administrator','/admin/revenue; /admin/reports','Show subscription-only metrics and state the 200-record report limit in the caption.');
shot('5.4','Activity filters and read-only event details','Administrator','/admin/activity','Redact actor/target IDs and show loaded-record filter labels.');
shot('5.5','Maintenance settings, health and audit history','Administrator','/admin/maintenance-security','Capture a demonstration notice; do not enable production maintenance merely for a screenshot.');
ch(6,'Payments, subscription purchases and refunds are separate operations with different records and authorities. This chapter explains the inspected implementation; it does not certify live-money settlement or backend objects that are absent from the available catalog exports.');
add(`## 6.1. Fixed-package quotation and downpayment\n\nLet P be package.price, C the included guest_capacity, m the minimum (one if absent), M the configured maximum and G the requested whole guests. A valid configuration requires 1 ≤ m ≤ C ≤ M. A customer must choose m ≤ G ≤ M.\n\nExtra guests = max(G − C, 0). Extra subtotal = round(P × extra guests / C, 2). Base subtotal = P + extra subtotal. Add-on subtotal = sum(menu price_per_guest × G × positive whole quantity). Final total = base subtotal + add-on subtotal. Downpayment = round(final total × authoritative downpayment_percent / 100, 2).\n\nThe frontend uses integer-cent arithmetic and positive half-up ratio rounding. The prepared pricing SQL uses exact NUMERIC arithmetic. Do not round the automatic per-guest rate before multiplying the extra guests. The displayed approximate rate is not the calculation authority. No manually configurable extra_guest_fee exists in the updated implementation.\n\n${table(['Guests for ₱50,000 / included 100 / min 50 / max 150','Fixed + extras, before add-ons'],[['49','Blocked'],['80','₱50,000.00'],['100','₱50,000.00'],['101','₱50,500.00'],['120','₱60,000.00'],['150','₱75,000.00'],['151','Blocked']])}\n\nFor 120 guests, a ₱100-per-guest menu item at quantity two adds ₱24,000.00. The final total is ₱84,000.00. At 25%, the deposit is ₱21,000.00. For a fractional-rate example, package ₱100.00 with capacity three and five guests has extra subtotal round(100 × 2 / 3, 2) = ₱66.67, total ₱166.67 before add-ons. A display rate of ₱33.33 must not produce ₱66.66.\n\n**Deployment condition:** max_guests and server-side quote/detail guards are provided in reviewed pricing SQL files. Their presence in the repository is not proof they are installed in the current project. The client blocks invalid/missing bounds; the backend must be installed and tested before relying on immutable server-recomputed quotes. Existing historical bookings retain saved prices.\n\n## 6.2. Booking payment initiation and provider confirmation\n\n1. The customer opens the eligible saved booking and checks its required deposit.\n2. xendit-payment authenticates the caller and reads the authoritative booking/customer/state/downpayment. It rejects stale amounts and already-used evidence.\n3. The server creates a PHP invoice through /v2/invoices with a booking_UUID_timestamp reference and server-generated ownership metadata. Invoice duration is 86,400 seconds (24 hours). The booking’s own deadline is a separate field.\n4. The customer completes a method supported by the hosted checkout. App options include GCash, Maya, BPI Online, BDO Online and Credit / Debit Card; selecting a preference does not prove that exact method was used.\n5. xendit-webhook checks the callback token, independently retrieves the exact invoice/eWallet charge from Xendit and compares identities. It handles invoice PAID and successful eWallet capture separately.\n6. Booking verification checks reference/booking/customer binding, PHP, matching amount, paid/captured amount, refund state and the booking’s current eligibility. Only then can the service-role guarded update record paid status, invoice reference and payment timestamps. Existing triggers remain enabled.\n7. The app’s status endpoint is read-only. It reports success only when provider success and matching database evidence both exist. Mobile screens refresh their read-only state.\n\nClosing a browser, seeing a success redirect, or observing an HTTP 200 callback is not enough. Non-success/ignored callbacks can also be acknowledged. The required outcome is the correct committed booking update or a verified duplicate no-op.\n\n## 6.3. Supported channels, references and payment failures\n\nThe chooser lists configured preferences; provider availability depends on the Xendit project, country/channel enablement and test configuration. The invoice creation code does not constrain hosted checkout to the app’s preference. Complete the actual provider flow and rely on independently retrieved evidence. Never send card passwords, OTPs or wallet credentials in chat or complaint screenshots.\n\nFor subscriptions, the updated webhook records gcash, maya, card or bank_transfer when identified by verified provider fields. Other specific channel tokens are normalized; online is the fallback when no specific method is available. It ignores customer-supplied metadata.payment_method as proof. Historical receipts remain unchanged even on redelivery. This method-recording change requires the matching deployed webhook; live deployment was not performed during manual preparation.\n\nPending or failed payments must not create paid status. Temporary provider/database failures return retryable 503 responses; mismatches generally return 422 for investigation. Invalid callback tokens are rejected. A duplicate invoice must not insert another subscription receipt, extend the term, overwrite another invoice’s booking evidence or send duplicate paid notifications. Booking concurrency losers re-read or retry; subscriptions use the existing row-locking transaction and unique reference index.\n\nIf a screen says Payment Processing, wait and refresh before another payment. If money was actually debited but records disagree, keep the reference and use an authorized investigation; do not manufacture a paid state. The configured return URLs are source strings and were not checked as publicly reachable pages.\n\n## 6.4. Manual/offline receipt verification\n\nThe current actionable Customer booking flow is Xendit. Legacy booking receipt fields and record-booking-callback.ts exist, but this helper is not the current webhook’s payment path. No complete current UI for uploading a non-Xendit booking receipt and having a caterer/staff approve it was confirmed. Accordingly, this manual does not invent an Upload Receipt or Verify Payment button. If an independently deployed offline process exists, it requires separate evidence and an approved supplementary procedure.\n\nRefund-proof upload is different: it records a caterer’s outgoing refund evidence and still requires customer receipt confirmation. Normal Xendit purchases need no Staff manual approval after secure provider verification.\n\n## 6.5. Subscription tiers and duration\n\n${table(['Tier','Displayed price','Package limit','Monthly accepted bookings','Verified display/ranking notes'],[
['Free','₱0','3','5','Basic visibility; no paid featured tier'],
['Basic','₱299','Unlimited','20','Higher default priority than Free; UI also advertises customization'],
['Standard','₱499','Unlimited','50','Eligible for featured listings and higher default priority'],
['Premium','₱999','Unlimited','Unlimited','Highest default tier priority and featured eligibility; no guaranteed exclusive first position']
])}\n\nThe server checks subscription_plans.price when creating/verifying a new paid purchase. The mobile/web tier constants are display values and can become stale if database prices change. Search priority is premium → standard → basic → free with business-name tie-breaking; explicit price/name sort and matching criteria still affect results. Do not promise every promotional benefit has a separate implemented entitlement switch.\n\nFor a new valid verified purchase, activate_paid_subscription validates plan/amount/reference, locks the caterer row, inserts a confirmed subscription_payments row and updates plan and expiry in one transaction. Expiry is now() + 30 days, not a variable-length calendar month and not remaining old time + 30 days. The function attempts counter/reset writes, while installed quota guards preserve/recompute authoritative accepted usage. A new purchase does not erase real accepted bookings.\n\nThe webhook checks ownership, plan, amount, confirmed receipt and resulting entitlement before accepting activated/already_processed as complete. An existing foreign, pending or mismatched receipt is not accepted merely because the RPC’s reference shortcut returned already_processed. An expired/superseded duplicate does not purchase another term.\n\nThe Renews label is not an implementation of scheduled recurring debit. A stored paid plan may remain visible after expiry; effective quota logic falls back to Free on expiry. A universal scheduled downgrade job and package-limit behavior on every expired-plan screen are not fully verified. Check the stored expiry and effective quota instead of relying on a badge alone.\n\n## 6.6. Booking status and deadline interpretation\n\nThe ordinary intended lifecycle is pending → confirmed → paid → ongoing → completed, with rejection/cancellation branches. awaiting_payment is supported in database checks and monitoring but not consistently exposed by mobile badge maps. Daily capacity counts the committed states; monthly quota counts the assigned acceptance month, not simply all bookings created or events occurring this month.\n\nThe wizard says the caterer has 24 hours to respond and the customer has 48 hours after confirmation to pay. However, the wizard initializes downpayment_deadline at submission time + 48 hours. The actual installed lifecycle trigger must determine whether that deadline is replaced on confirmation. The source invoice itself expires after 24 hours. Automatic overdue cancellation depends on deployed jobs/logic not fully available here. Follow the saved booking’s actual deadline and report inconsistencies; do not promise an unverified scheduler.\n\n## 6.7. Customer cancellation refund schedule\n\nThe following schedule is confirmed in current client helpers and FAQ text. The cancellation UI calls a protected server endpoint and uses its returned final amount; that endpoint/RPC’s exact current body is absent locally. The client day preview uses the device calendar date, while previously reported server rules use Asia/Manila. Keep the device on Philippine time and treat the preview as an estimate.\n\n${table(['Customer cancellation timing','Refund of verified downpayment'],[['Fewer than 7 calendar days before event','0%'],['Exactly 7 days','25%'],['8–14 days','50%'],['15–29 days','75%'],['30 or more days','100%'],['Within 24 hours after payment verification AND at least 7 days before event','100% grace-period refund']])}\n\nThe grace period starts at payment verification, not at signup, booking creation or opening checkout. Fewer than seven days remains 0% even during the grace period. The calculation uses verified downpayment, not the full booking price. No verified deposit means no refundable paid deposit in the preview. For example, a verified ₱20,000 deposit cancelled ten days before the event outside the grace period estimates ₱10,000 refundable. A caterer-initiated eligible cancellation uses a full verified-downpayment obligation in the current caterer handler.\n\n## 6.8. Refund operations and disputes\n\n1. The protected cancellation records cancelled status and any due refund amount/destination. A recording is not a transfer.\n2. A refund is generally due within 72 hours of cancellation under the inspected deadline trigger/FAQ. Review the actual saved refund_due_at; maintenance adjustment logic can affect deadlines.\n3. The caterer transfers externally, checks the customer destination, and submits reference plus receipt through submit-refund-proof.\n4. Successful evidence submission moves tracking toward awaiting_customer_confirmation. A late submission remains recorded as late.\n5. The customer checks their own wallet/bank, then calls the protected receipt-confirmation flow. Only actual receipt should be confirmed.\n6. If money did not arrive, the customer files a missing-refund report. The caterer can save an investigation response. Staff can inspect the evidence and general complaint context but the current refund-monitoring screen does not adjudicate or process a transfer.\n7. After the authorized processed transition, collected triggers notify the caterer and resolve related refund disputes.\n\nMissing destination after caterer cancellation is a current limitation: the customer screen instructs contact through chat and references an undeployed protected destination-completion endpoint. Do not invent a new form. Keep destination information private and use the project’s approved process.\n\n## 6.9. Notifications and reporting interpretation\n\nBooking/payment/refund notifications depend on database triggers and the in-app notifications table. A notice is not independent cash evidence. The visible list shows at most 50 recent items. No push/email delivery guarantee is established.\n\nCaterer Estimated booking value sums accepted-status booking total_cost for bookings created in the selected period. Verified Downpayments Received separately sums required downpayment_amount on paid/ongoing/completed records with non-null references and payment_verified_at in the period. Neither is an independent settlement ledger. Settled refunds is shown unavailable; refund obligations represent amounts still outstanding, not cash already paid. Admin revenue concerns confirmed subscription receipts only. Never add these unrelated metrics together as net earnings.`);
ch(7,'The following procedures combine verified screens into end-to-end paths. Any CONDITIONAL backend step must succeed before proceeding. A flowchart arrow means the next expected stage, not an automatic entitlement to that stage.');
const workflows=[
['Customer registration to a saved booking',['Open the supplied mobile build and choose Sign up → Customer.','Complete the required account fields and policy agreement, then CREATE ACCOUNT.','Confirm email if required by project configuration, then LOG IN.','Browse approved caterers and inspect a published package.','Complete Package, Details, Customize and Review; check the final quotation.','Select Submit Booking Request and verify the pending record in View Bookings.']],
['Caterer application to verification approval',['Register as Caterer and log in.','Open Business → business editor and save accurate business/contact information.','Upload the five required document images and inspect progress.','Staff opens Caterer Verification, selects the application and audits the files.','Staff records the approved or rejected decision and any required reason.','Caterer refreshes the Business badge; only approved records enter public discovery.']],
['Package creation to published listing',['Caterer opens Packages → Add Package.','Set fixed price, minimum/included/maximum guests, food, service inclusions and event types.','Create Package and verify it starts unpublished.','Review the saved offer and select Publish.','Customer refreshes approved listings and inspects the public offer; visibility remains subject to RLS and verification.']],
['Booking submission to confirmation',['Customer submits a pending request with a valid event date and quote.','Caterer opens Review & Respond and checks details, package state and both capacity limits.','Caterer selects Confirm Booking Request or rejects with a reason.','The server validates publication, ownership, suspension, daily availability and monthly acceptance quota.','Both parties refresh and inspect the resulting status; failed confirmation leaves the request unconfirmed.']],
['Confirmed booking to successful downpayment',['Customer opens the eligible confirmed booking and its payment chooser.','Customer reviews the stored deposit and opens Xendit hosted checkout.','Xendit confirms the provider payment; the authenticated webhook independently checks the provider record.','The guarded server update succeeds for that exact booking and reference.','The app reads provider plus database-confirmed status and displays Payment Confirmed; if pending, do not repeat the charge.']],
['Completed event to customer review',['Caterer marks an actually paid eligible event ongoing, then completed when service is finished.','Customer refreshes Bookings and selects Write Review.','Customer rates Food Quality, Service Quality, Timeliness and Overall and optionally comments.','Customer submits and verifies Review Submitted/My Reviews.','Caterer may reply through the completed booking; this does not alter the customer ratings.']],
['Cancellation to refund resolution',['Eligible party starts cancellation and reads the policy/due amount.','Customer provides a destination during refundable customer cancellation; caterer cancellation may require destination follow-up.','The server records cancellation/refund obligation; the caterer transfers externally.','Caterer uploads transfer reference/proof through the protected endpoint.','Customer checks funds independently and confirms receipt, or reports a missing refund.','Caterer responds to disputes; Staff monitor the case. Only the authorized receipt workflow closes actual receipt tracking.']],
['General complaint to Staff resolution',['Customer/Caterer opens File a Complaint and submits type, description and relevant context.','Staff opens Complaints and selects the ticket.','Staff reviews information, adjusts priority and records Resolution Log & Findings.','Staff changes the ticket to In Review, Resolved or Closed as appropriate.','Reporter refreshes My Reports/My Complaints for status and Staff Resolution; no guaranteed 24–48 hour outcome is inferred.']],
['Subscription purchase to automatic activation',['Caterer opens Plans & Billing and chooses a paid plan.','Customer identity here is the caterer owner; checkout uses the authoritative plan price and server-generated subscription reference.','Caterer completes Xendit checkout.','Authenticated webhook independently verifies paid PHP amount, provider invoice and caterer/plan binding.','Existing activate_paid_subscription commits confirmed receipt and 30-day entitlement; webhook verifies committed state.','Caterer refreshes CURRENT PLAN, usage and Payment History. No normal Staff manual approval follows verified success.']],
['Administrator creation of a new Staff account',['Administrator opens Platform Settings → Add Staff Account.','Enter a new unused email, full name and valid matching initial password.','The endpoint verifies administrator authorization before creating a new initially banned identity.','Finalization assigns Staff through the protected database workflow, then the endpoint unbans only that newly created identity.','Administrator verifies the new Staff row and shares credentials privately.','Staff signs in at /login. On an unconfirmed stage, stop and investigate instead of repeating account creation.']]
];
workflows.forEach(([name,steps],i)=>add(`## 7.${i+1}. ${name}\n\n${steps.map((s,n)=>`${n+1}. ${s}`).join('\n')}`));
add(`## 7.11. Compact workflow diagrams\n\nBooking:\n\nPending request → [Caterer review + server eligibility checks]\n  → Rejected (with reason)\n  → Confirmed → [Xendit + database-confirmed deposit]\n      → Paid → Ongoing → Completed → Customer review\n  → Eligible cancellation → No refund OR recorded refund obligation\n\nRefund:\n\nRefund obligation → Caterer external transfer → Evidence submission\n  → Awaiting customer confirmation → Customer confirms actual funds → Processed\n  → Missing-refund report → Caterer investigation update + Staff monitoring\n\nSubscription:\n\nChoose paid plan → Server-priced invoice → Hosted checkout\n  → Authenticated webhook + independent provider check\n  → Existing atomic activation RPC → Confirmed receipt + 30-day plan\n  → Duplicate delivery → Verified no-op (no new term)\n\nThese diagrams intentionally separate a request, payment evidence, cash receipt and record completion.`);
ch(8,'Use the specific displayed error and saved record state to troubleshoot. After a timeout, first determine whether the operation already committed. Never share passwords, OTPs, service keys, raw provider payloads or unredacted bank/account details in support messages.');
const problems=[
['Project will not open in Expo Go','Incompatible SDK/client, stopped development server or restricted local network','Use the operator-provided compatible client/build and current project link; ask the operator to check the development server.'],
['Maintenance notice or platform-status error','maintenance_enabled is true or settings could not be read','Read the notice and use the displayed retry/foreground refresh; contact the operator if status cannot be verified.'],
['Missing fields / Login Failed','Required login details absent, wrong credentials or unreadable profile','Complete email/password, retry once with correct credentials and report account-status errors without exposing credentials.'],
['Account suspended','Stored suspension status; reason lookup may be restricted','Read the reason if provided and contact authorized support. Do not create another account to bypass the restriction.'],
['Forgot password? does nothing','No implemented reset handler on the reviewed login screens','Contact the project administrator through the approved external support process. No in-app recovery is documented.'],
['Verification email not received','Project email settings, rate limits, spam filtering or wrong/session-missing email','Check the address/junk folder; use Resend Verification Email only with the correct session, or ask the operator to inspect configuration.'],
['No caterers found','Restrictive search, category, budget/city or no approved/published offers','Clear Filters; widen budget/guest criteria; refresh and distinguish an empty result from a load error.'],
['Check guest count / package limits need setup','Missing max_guests, invalid configuration or out-of-range/fractional guests','Choose a valid whole number. Caterer/operator must correct the configuration; do not manipulate totals.'],
['Date Unavailable / fully booked','Blocked date, daily capacity reached or stale availability','Select another date, refresh and recheck. A pending request does not reserve a slot.'],
['Monthly booking limit reached','Current accepted-booking quota exhausted','Leave the request pending; review actual usage/expiry and the plan. Do not delete booking history or alter cached counters.'],
['Payment amount changed / STALE_AMOUNT','Stored deposit or plan price differs from the submitted amount','Refresh the booking/plan and review the authoritative amount before another checkout.'],
['Payment Processing after provider success','Webhook/database update or confirmation still pending','Keep the reference, wait and refresh. Do not pay again. The operator should inspect safe webhook codes and verified records.'],
['Payment Failed / declined / expired','Provider did not complete the eligible payment','Verify provider state and inspect the booking before retrying a new authorized attempt.'],
['Subscription paid but plan not active','Wrong/partial existing receipt, verification mismatch, failed RPC or stale UI','Refresh plan/history. Report the reference and safe error; Staff correction requires an existing valid confirmed receipt, not manual paid-state creation.'],
['Duplicate/reference conflict','The reference already belongs to another record or state','Stop and request authorized investigation. Do not reuse it, rewrite it or repurchase to hide the conflict.'],
['Payment method shows online','Old receipt or verified provider response lacks a specific channel','Retain history. New method recording requires the deployed updated webhook and identifiable provider fields; app preference is not proof.'],
['Upload failed / Permission Required','Denied photo permission, inaccessible bucket or network failure','Grant photo permission if intended; use a legible allowed image; check the record after timeout before uploading again.'],
['Document preview unavailable','Signed URL expired, private storage denial or unsupported rendering','Reopen Audit File. Use authorized download only; ask the operator to check storage policies rather than making the bucket public.'],
['Messages do not refresh / could not identify recipient','Network/Realtime configuration or inaccessible booking participant','Use Refresh, reopen the correct booking conversation, and confirm sign-in. Do not substitute another user ID.'],
['Reaction permission denied / 42501','RLS or participant/column authorization denied','Refresh and report the safe error code. No client change can legitimately override database permission.'],
['Reaction field needs setup / 42703 / PGRST204','Missing reaction column/schema cache setup','Ask the operator to complete the reviewed metadata/setup process; do not repeatedly react or weaken RLS.'],
['Customer details could not be loaded','Direct profile query denied by RLS or missing record','Use Try again; ask for authorized profile-access review. Do not grant broad personal-data access as a workaround.'],
['Notes changed elsewhere / 40001','Another editor saved a newer revision','Preserve the draft, reload the saved note with confirmation, then merge/reapply intentionally.'],
['Internal notes/reports setup not installed / PGRST202 / 42883','Required RPC missing or undiscovered','Contact platform support for the approved setup. Do not fall back to public caterer_notes for private notes.'],
['Refund destination missing','Caterer cancellation without a destination-completion path','Use booking chat and the project’s approved private follow-up. Do not transfer until the destination is confirmed.'],
['Refund proof submission unconfirmed','Possible server commit before network failure','Refresh booking/evidence first; the app deliberately retains the uploaded receipt after an attempted submission.'],
['Refund still pending after proof','Customer has not confirmed receipt; proof alone is insufficient','Customer checks actual wallet/bank funds and confirms only after receipt. If absent, submit a missing-refund report.'],
['Complaint/status change appears unsaved','Database denied a write or UI did not surface the full error','Reload the record before proceeding; report the failure instead of assuming the selected status persisted.'],
['Staff provisioning unconfirmed','Creation/finalization/activation may have partly completed','Stop. Ask the project owner to inspect the new account and audit state; never automatically repeat creation or activate an uncertain identity.'],
['Secure role management not installed','Role RPC absent or unauthorized','Contact the administrator/developer. Never replace it with a direct profiles.role update.'],
['Admin direct reactivation denied','Suspension trigger requires the audited workflow','Use authorized Account Monitoring with a reason rather than bypassing the trigger.'],
['CSV missing older records','Reports loads at most 200 recent rows','Treat it as a snapshot; request a separately authorized full export if needed.'],
['Notification opens an unexpected page','Ungrouped route/deep-link mismatch','Open Bookings, Messages or Business/Profile directly and inspect the relevant record.']
];
add(table(['Problem','Possible cause','Recommended action'],problems));
add(`## 8.1. Safe incident information\n\nRecord the affected screen/role, approximate Philippine local time, action taken, displayed safe error code and whether a record exists after refresh. Share identifiers only with authorized maintainers through a private channel. Never include passwords, access tokens, callback tokens, card details, service-role keys or full customer/provider objects. Keep an original receipt privately when needed for an authorized reconciliation.\n\n## 8.2. Escalation boundaries\n\nCustomers and caterers can use general complaints and booking conversations where accessible. The source does not provide a universal live Staff consultation channel or a verified support telephone/email endpoint; obtain the institution’s approved contacts from the operator. Account suspension or a maintenance gate may restrict app-based help, so an approved external support process is required. This manual does not invent a support address or promise a response deadline.`);
ch(9,'Security instructions here distinguish source-confirmed checks from deployment conditions. A label such as Private or Secure is not by itself evidence of complete protection.');
add(`## 9.1. Account and password safety\n\nUse unique passwords and private devices where possible. Keep passwords, wallet PINs and OTPs out of chat, screenshots, complaints and CSVs. Use the eye control only when nearby people cannot see the screen. Confirm signout on shared devices. Current public signup allows only Customer/Caterer choices; Staff creation is restricted to an administrator-authorized new identity flow. No verified self-service MFA or password-recovery page is provided in this source.\n\n## 9.2. Role authorization and personal data\n\nThe web portal checks an authenticated authoritative profile role before admitting Staff/Admin routes. Mobile actions scope queries to account/booking identities, while Supabase RLS and column grants must independently enforce access. Client filtering is not a replacement for server authorization. The customer-profile modal verifies a booking relationship in the client then reads profiles directly; deployed RLS must protect personal details. Its unused RPC helper/proposal is not proof that the current component uses a narrowly projected backend endpoint.\n\nCaterers should use customer phone/address/email only to service the relevant event. Customers should share the minimum necessary personal/event information. Staff and Admin should not copy personal records into public channels. The complete behavior of deployed profile/document/message policies was not audited live during this manual task.\n\n## 9.3. Internal notes and business documents\n\nInternal Notes uses separate private storage accessed through assigned-caterer RPC authorization and revision checks in the reviewed SQL. The UI’s team wording does not introduce employee membership accounts. Trusted database administrators remain privileged. The old bookings.caterer_notes field is customer-visible and must not be used for private operational reminders.\n\nBusiness documents use storage links and Staff preview may fall back to the stored URL. Private document access depends on actual storage configuration; do not claim all document URLs are protected solely because signed previews are attempted. Refund proofs use authorized signed URLs in the inspected monitoring UI. Do not share those links publicly or infer that expiration revokes copies already downloaded.\n\n## 9.4. Payments and refunds\n\nHosted checkout is initiated by authenticated server code using authoritative booking/plan values. Webhook authentication and independent provider lookups precede privileged writes. The mobile success screen cannot activate subscriptions or declare paid status on its own. The existing atomic subscription function and unique references prevent duplicate receipts when used correctly; the webhook also verifies ownership and committed entitlement. No provider credentials belong in the mobile application or public environment variables.\n\nA paid booking status alone is not an independent settlement ledger. Refunds require actual external transfer and customer confirmation. Record obligations, proof submissions, disputes and received funds separately. Never ask a user to pay an invented platform debt to clear a refund issue. Keep original financial evidence according to the institution/platform’s approved retention rules; the source does not establish a complete legal retention schedule.\n\n## 9.5. Staff creation, role management and audit interpretation\n\nStaff provisioning verifies the caller and uses an initially banned new Auth identity, protected database finalization and activation. Ordinary Customer/Caterer accounts are not converted. Role management operates on existing Staff/Admin identities through a dedicated RPC, with self/last-admin safeguards in the reviewed proposal. Actual installed SQL and endpoint configuration must match these expectations.\n\nAccount Monitoring requires a reason and records moderation through RPCs when installed. Direct User Management status writes do not collect a reason and cannot be assumed audited. Activity Logs combines real moderation events with activity reconstructed from business records. It is not a complete immutable log of all changes. Maintenance history is limited to the queried actions and loaded entries.\n\n## 9.6. Exports and demonstration privacy\n\nUse synthetic or consented accounts for capstone screenshots. Redact names, contact numbers, addresses, IDs, transaction references and verification documents. Export only when authorized and store the resulting CSVs securely; downloaded files no longer benefit from database access controls. Review spreadsheet content as untrusted input. Do not place production keys, connection strings or real financial payloads in this manual. No penetration test, full compliance certification, encryption-at-rest audit or end-to-end chat encryption claim is made.`);
ch(10,'These limitations are part of the current system description and should remain in the capstone manuscript until separately resolved and tested. They are not missing instructions for nonexistent buttons.');
const limitations=[
['Inactive password recovery','UNVERIFIED','Forgot password? appears on mobile/web login but no active recovery handler/page was found.'],
['Email-verification enforcement','CONDITIONAL','VerifyEmailScreen exists; redirects/session settings and an unused broken helper prevent claiming a universal enforced booking gate.'],
['Consultation inbox and Staff chat','UNVERIFIED','Consultation route files are absent/deleted; no current navigator or portal route provides the feature.'],
['Manual non-Xendit booking receipt approval','UNVERIFIED','Receipt fields and legacy helper remain, but no full actionable upload/reviewer UI was found in current payment screens.'],
['Atomic reaction updates','CONDITIONAL','Whole-map JSON writes and unknown reaction policies can deny or race. Immediate display does not prove a durable synchronized result.'],
['Narrow customer-profile RPC integration','PLANNED','A helper/proposal exists, but the current modal directly reads profiles under RLS. No isolated-privacy claim is inferred.'],
['Fixed-price backend rollout','CONDITIONAL','Client expects max_guests. Guarded migration and execution file exist, but installation status is not proved by repository presence.'],
['Bookmarks deployment','CONDITIONAL','package_bookmarks queries exist; complete deployed schema/policies were not provided in collected exports.'],
['Later refund-destination form','PLANNED','Customer screen explicitly says the protected endpoint is needed. No complete later-entry UI is verified.'],
['Refund Edge implementation','UNVERIFIED','cancel-customer-booking, submit-refund-proof and confirm-customer-refund are invoked but their source folders are absent. Their current server bodies were not inspected.'],
['Deadline guarantees','UNVERIFIED','24-hour review/48-hour payment wording does not establish a complete scheduler; submission initializes a 48-hour deadline and invoices expire after 24 hours.'],
['Recurring billing','UNVERIFIED','Renews label is not auto-debit. The existing activation grants a new 30 days from processing, without carrying remaining time.'],
['Automatic expired-plan downgrade everywhere','CONDITIONAL','Effective monthly quota falls back to Free, but stored badge/plan and all quantity behavior may not be reset by a verified scheduler.'],
['Caterer report cash accounting','CONDITIONAL','Recorded downpayments use required deposits and verification fields, not an independent provider settlement ledger. Settled refund total is unavailable.'],
['Caterer chart window','IMPLEMENTED','Only five months ending at report end are shown; filtered-out months appear zero. Full This Year data may exceed visible chart months.'],
['Admin revenue date labels','IMPLEMENTED','This Month/This Week are rolling 30/7 days, not calendar accounting periods.'],
['Report completeness','IMPLEMENTED','Admin CSVs use at most 200 rows per report; some other unpaginated portal reads are subject to API limits.'],
['Refund disbursement by Staff','UNVERIFIED','Dashboard wording suggests processing, but the destination screen is read-only and the caterer transfers funds.'],
['Free-tier grant on verification','UNVERIFIED','Approve & Grant Free Tier writes verification fields but does not explicitly reset subscription_plan.'],
['Direct Admin reactivation/audit','CONDITIONAL','Directory writes may be trigger-blocked and have no reason entry. Use Account Monitoring when installed.'],
['Maintenance descriptions','CONDITIONAL','Current mobile gate restricts navigation even though a portal success notice says operations are not automatically blocked; all backend behavior is not implied.'],
['Storage and profile privacy','CONDITIONAL','Direct profile reads, URL fallbacks and backend policies need deployed verification; no universal security guarantee is inferred.'],
['Staff/Admin account settings and notifications','UNVERIFIED','No dedicated profile/password settings, consultation or notification management page is routed.'],
['Mobile payment label consistency','CONDITIONAL','Awaiting-payment and notification links are not consistent across all mobile maps/routes; test on actual Android/iOS builds.'],
['Test versus live money','UNVERIFIED','Project context uses Xendit test mode. No live-money settlement, bank payout, provider fee or tax reconciliation was validated.'],
['Historical last_payment_reference','LEGACY / KEEP','Investigation was closed with explicit retention. Its purpose remains uncertain. Do not delete, rename or reinterpret the column.'],
['Offline mode and distribution','UNVERIFIED','No offline booking/payment queue, published store release, minimum hardware benchmark or full compatibility certification was verified.'],
['Policy acceptance/legal retention','CONDITIONAL','Client agreement and version metadata exist, but a durable consent-history deployment and legal approval are not established.']
];
add(table(['Area','Classification','Actual limitation'],limitations));
add(`## 10.1. Operational acceptance required\n\nBefore treating this manual as the definitive guide for a deployed demonstration, confirm the selected app/web build, installed database objects, effective RLS/storage policies, checkout/provider mode and available support contacts. Execute authorized test scenarios in an isolated/test environment for each role; do not trigger payments or alter production merely to obtain screenshots. Add the screenshot date/build and test outcome to Appendix F. Local code-level payment tests from earlier work are not a substitute for this acceptance exercise.\n\n## 10.2. Changes that require a revised manual\n\nRevise procedures when routes/labels change, when the refund endpoint bodies become available, when pricing/server guards are installed, when profile/reaction security is resolved, or when legal policies, tier prices, channel availability or provider mode change. Keep a version/date and evidence trail. Do not silently remove caveats because a proposed migration exists.`);
ch(11,'The following terms use the meanings established in this implementation.');
const glossary=[
['Administrator','Privileged web user authorized for administrative routes and restricted operational functions.'],['Audit log','Recorded actor/action/context history where explicitly implemented; not every screen update is automatically audited.'],['Awaiting Payment','Backend booking state for an outstanding payment step; separate from verified paid evidence.'],['Booking','A saved event request/reservation linking a customer, caterer, package, event details and stored quotation.'],['Budget Matcher','Home tool that filters eligible package base totals against budget and guests, excluding optional additions.'],['Cancelled','Booking lifecycle state after an authorized cancellation; refund obligations can remain unresolved.'],['Caterer','Business owner account managing its own offers, assigned events and subscription.'],['Completed','Event recorded as finished, normally after ongoing; eligible customer review can follow.'],['Confirmed','Accepted booking, subject to payment/deadline requirements; not proof that money was collected.'],['Customer','Mobile user who browses caterers and manages personal requests, payments and event feedback.'],['Daily capacity','Maximum committed bookings per event date across the caterer’s packages.'],['Dispute','Recorded unresolved issue, such as a missing-refund report; distinct from a general complaint ticket.'],['Downpayment','Required portion of the saved final booking total; not the entire event value.'],['Extra Guest Charge','Rounded subtotal for guests above included capacity, using the unrounded package price/capacity ratio.'],['Fixed package price','Full base package amount payable for a valid guest count up to included capacity.'],['Guest Capacity','Included number of guests covered by the fixed price; it is not always the maximum supported guests.'],['Internal Notes','Private assigned-caterer operational content stored separately from customer-visible booking notes.'],['Invoice','Provider-created request for a specific PHP payment with reference and server-generated metadata.'],['Maximum guests','Highest allowed guest count for a package; extra guests beyond this count cannot proceed.'],['Menu add-on','Separately priced dish charged per guest and selected quantity.'],['Monthly quota','Accepted/committed bookings assigned to a quota month in Asia/Manila, checked when accepting a request.'],['Ongoing','An event recorded as in progress after the eligible paid stage.'],['Paid','Booking lifecycle state with the relevant verified deposit recorded; not a bank settlement or full-balance guarantee.'],['Payment Reference','Identifier tying verified provider evidence or a saved receipt to the correct payment record.'],['Pending','A request awaiting caterer action; it does not reserve daily capacity or consume acceptance quota.'],['Platform Staff','Operational web role reviewing applications, complaints and authorized monitoring data.'],['Publication','Package state: published, unpublished or archived; controls new-booking discovery without erasing accepted history.'],['Refund','Money to be returned following an eligible cancellation; an obligation, proof submission and actual receipt are separate states.'],['Rejected','A request/application that was declined with the relevant explanation.'],['Revision','Version number checked when saving Internal Notes to prevent stale overwrites.'],['RLS','Row-Level Security: database policies restricting which rows a database caller may access; client UI hiding is insufficient.'],['RPC','A database function called through Supabase; authorization depends on the actual function and grants.'],['Subscription','Caterer plan entitlement governing configured package and monthly booking limits.'],['Verification','A context-dependent check: email confirmation, business approval, or trusted payment evidence verification.'],['Webhook','Server endpoint receiving provider events; authentication and independent provider verification precede payment writes.'],['Xendit','Hosted payment provider used by this project’s booking deposit and subscription flows, currently in test context.']
];
add(table(['Term','Meaning'],glossary));
ch(12,'These appendices provide the feature inventory, permission boundaries, navigation reference, screenshot plan and source evidence. Use the companion verification matrix for file-level traceability.');
add('## Appendix A. Complete documented procedure inventory\n\nCounts refer to numbered procedure entries, not individual buttons or backend functions. A combined procedure can cover related actions such as add/remove. CONDITIONAL entries are included because their client path exists; their conditions must be checked before use.');
for(const role of Object.keys(roleChapter)){
 const own=features.filter(f=>f.role===role);
 add(`### A.${roleChapter[role]-1}. ${role} — ${own.length} procedure entries\n\n`+table(['ID','Feature','Status','Section'],own.map(f=>[f.id,f.title,f.status,f.number])));
}
const permissions=[
['Public browse approved/published offers','Yes; guest browse','Customer-facing view','Not a Staff editing function','Can inspect via authorized routes'],
['Own profile/business changes','Own personal profile','Own business/personal profile','No dedicated self-profile editor','No dedicated self-profile editor'],
['Create event request/pay deposit','Own bookings','No customer-payment authority','No direct paid-state override','No direct paid-state override'],
['Accept/reject/progress event','No','Assigned caterer, valid lifecycle','Monitor only','Staff monitor route; no extra transition button'],
['Publish/archive packages','No','Own offers only','No package management route','No package management route'],
['Private Internal Notes','Denied by private-note authorization','Assigned caterer account','Not supported team identity','Not supported team identity; database administrators remain privileged'],
['Booking messages/reactions','Booking participant','Booking participant','No consultation/chat route','No consultation/chat route'],
['View customer profile in chat','Own context; no arbitrary lookup','Related booking; RLS required','Only other authorized operational records','Only other authorized operational records'],
['Cancel event','Eligible own booking','Eligible assigned booking','No booking cancellation action','No booking cancellation action'],
['Submit refund proof','No','Own eligible obligation','Monitor only','Monitor only'],
['Confirm actual refund receipt','Affected customer','No','No','No'],
['File missing-refund report','Affected customer, eligible state','Respond through RPC','Monitor only in refund screen','Monitor only in refund screen'],
['General complaint ticket','Submit own/read permitted history','Submit own/read permitted history','Review/priority/status/notes','Authorized Staff route'],
['Business verification decision','No','Submit documents, not self-approve','Approve/reject when authorized','Authorized Staff route'],
['Subscription purchase','Not a Customer feature','Own business','No normal payment approval','No normal payment approval'],
['Subscription correction','No','No self-award','Confirmed receipt + secure RPC','Same receipt/reason restrictions'],
['Moderate account','No','No','Reason-required Account Monitoring RPC','Same RPC; directory direct writes may be blocked'],
['Create new Staff identity','No','No','No','Admin-only endpoint + installed finalizer'],
['Change Staff/Admin role','No','No','No','UI lists existing privileged accounts; no self changes; broader RPC scope needs review'],
['CSV reports/activity/maintenance','No','Own reports only','No Admin report/maintenance route','Authorized Admin routes only']
];
add('## Appendix B. Role-permission matrix\n\n'+table(['Action','Customer','Caterer','Staff','Administrator'],permissions)+'\n\nThis matrix describes offered application actions and reviewed checks, not a certificate that every deployed database permission has been audited. No direct database administration privileges are implied by an application role.');
add(`## Appendix C. Status references\n\n### C.1. Booking lifecycle\n\n${table(['Stored value','User meaning','Usual next operation / caution'],[
['pending','Awaiting caterer review','Confirm, reject or eligible customer cancellation; no reserved slot'],
['confirmed','Accepted; deposit outstanding','Eligible Xendit deposit or cancellation; not proof of payment'],
['awaiting_payment','Outstanding payment workflow state','Backend/monitoring support exists; mobile representation varies'],
['paid','Verified deposit recorded','Eligible ongoing or cancellation; full balance may remain'],
['ongoing','Event in progress','Eligible completed action; not ordinary cancellation through current UI'],
['completed','Event finished','Customer review; accepted history retained'],
['rejected','Request declined','Read reason/history; not a paid event'],
['cancelled','Reservation withdrawn','Track any refund obligation; cancellation alone does not settle it']
])}\n\n### C.2. Provider and saved payment states\n\n${table(['Record/system','State','Interpretation'],[
['Xendit invoice','PAID','Provider final-paid candidate; still independently verify identity/amount and database update'],
['Xendit eWallet charge','SUCCEEDED','Successful capture candidate; capture amount and binding still checked'],
['Xendit invoice','PENDING','No paid-state update'],
['Provider unsuccessful state','FAILED / VOIDED / EXPIRED where returned','Do not credit the booking or activate a plan'],
['subscription_payments','pending','Unconfirmed receipt; not accepted as a completed purchase'],
['subscription_payments','confirmed','Saved confirmed subscription receipt; ownership/plan/entitlement still verified'],
['subscription_payments','rejected','Rejected subscription receipt, not an entitlement'],
['Mobile polling','success / failed / cancelled / pending','Client outcomes derived from checks; success requires databaseConfirmed=true'],
['Webhook response','HTTP 200','Processed or safely ignored event; not a universal declaration of paid state'],
['Webhook response','HTTP 503','Retryable provider/database processing problem'],
['Webhook response','HTTP 422','Verification mismatch/rejected processing requiring investigation']
])}\n\n### C.3. Refund and evidence states\n\n${table(['Record','Value','Interpretation'],[
['bookings.refund_status','none','No recorded refund obligation'],
['bookings.refund_status','pending','Refund obligation awaiting transfer/evidence'],
['bookings.refund_status','overdue','Obligation/proof deadline overdue; inspect saved deadline'],
['bookings.refund_status','awaiting_customer_confirmation','Evidence submitted; customer must check actual funds'],
['bookings.refund_status','processed','Authorized receipt workflow recorded completion'],
['Legacy/UI compatibility','failed','Appears in older monitoring types; not a current documented recovery transition'],
['refund_transfer_submissions.status','submitted / verified / rejected where stored','Evidence review states; current Staff screen reads them without offering status-changing controls'],
['refund_disputes.status','open / investigating / resolved','Missing-refund report tracking; not itself a bank settlement'],
['complaints.status','open / in_review / resolved / closed','General complaint ticket workflow, distinct from refund dispute state']
])}\n\n### C.4. Business, publication and subscription references\n\n${table(['Area','Values','Notes'],[
['Business verification','pending, approved, rejected; UI Not Submitted fallback','Approval and email confirmation are separate'],
['Package publication','unpublished, published, archived','Restore means unpublished, requiring another explicit Publish'],
['Caterer account standing','good_standing, refund_overdue, suspended','Refund/account protection checks apply; not a payment receipt'],
['Subscription plan','free, basic, standard, premium','Read expiry and effective quota, not just the stored name'],
['Profile role','customer, caterer, staff, admin','Public signup only offers the first two']
])}`);
const appRoutes=sources.filter(f=>f.startsWith(A)&&f.endsWith('.tsx')&&!f.endsWith('/_layout.tsx'));
const webRoutes=[['/login','Shared login','pages/Login.tsx'],['/staff','Staff Dashboard','pages/staff/Dashboard.tsx'],['/staff/verification','Caterer Verification','pages/staff/CatererVerification.tsx'],['/staff/subscriptions','Subscription Management','pages/staff/SubscriptionManager.tsx'],['/staff/complaints','Complaints & Disputes','pages/staff/Complaints.tsx'],['/staff/bookings','Booking Monitor','pages/staff/BookingMonitor.tsx'],['/staff/account-monitoring','Account Monitoring','pages/staff/AccountMonitoring.tsx'],['/staff/refunds','Refund Monitoring','pages/staff/RefundManagement.tsx'],['/admin','Admin Dashboard','pages/admin/Dashboard.tsx'],['/admin/users','User Directory','pages/admin/UserManagement.tsx'],['/admin/revenue','Revenue & Subscriptions','pages/admin/Revenue.tsx'],['/admin/reports','System Reports / CSV','pages/admin/Reports.tsx'],['/admin/activity','Activity Logs','pages/admin/ActivityLogs.tsx'],['/admin/settings','Platform Settings','pages/admin/PlatformSettings.tsx'],['/admin/maintenance-security','Maintenance & Security','pages/admin/MaintenanceSecurity.tsx']];
add('## Appendix D. Actual screen and navigation inventory\n\n### D.1. Mobile file routes\n\nThe route-group notation below is the Expo source/navigation notation. Hidden tab routes are real screens reached from links; they are not additional visible tabs. Wrapper routes import shared screen components. A file route by itself does not prove a menu link exists.\n\n'+table(['Route/source notation','Role/access context','Source'],appRoutes.map(f=>{
const route=f.slice(A.length,-4);let context=route.startsWith('(caterer)')?'Caterer':route.startsWith('(tabs)')?'Customer; some public browsing':route.startsWith('(auth)')?'Authentication/guest':'Template/support; no verified ordinary menu entry';
return['/'+route,context,f];
}))+'\n\n### D.2. Portal routes\n\n'+table(['Route','Screen','Source'],webRoutes.map(r=>[r[0],r[1],W+r[2]])));
add(`### D.3. Shared mobile modals and support components\n\n${table(['Component','Entry/context','Access/condition'],[
['ChatScreen','Booking action or Messages thread','Current booking participant; no Staff consultation route'],
['ConversationCustomerProfile','Caterer chat customer avatar/name','Booking relationship checked; direct profiles query still requires RLS'],
['SubscriptionScreen','Business → Subscription Plan; Dashboard Upgrade','Caterer modal; not a standalone App route'],
['PaymentScreen','Legacy/shared payment component; current Bookings also embeds its own chooser','Component presence is not a separate navigation route'],
['ReviewScreen','Completed booking → Write Review','Customer modal'],
['NotificationsScreen','Role-specific notifications wrapper or Dashboard/Home bell modal','Current account; latest 50'],
['FAQScreen','Role-specific faq wrapper','Role-specific static/searchable questions'],
['BookingInternalNotes','Caterer booking detail','Assigned caterer private RPC'],
['PackageComparisonBar','Customer navigator above tabs','Customer selection; 2–3 for comparison'],
['MonthlyBookingQuotaSummary','Dashboard/Bookings/Plans & Billing','Owner-scoped count and effective plan'],
['MaintenanceGate','Root mobile layout','Blocks navigation on active maintenance/unreadable settings'],
['app/modal.tsx','Remaining template file','No confirmed ordinary user workflow; do not document as a business module']
])}\n\nNo current consultation route appears in either role navigator or the web route tree. Web Staff/Admin profile/settings notification pages are not present. A sidebar user card is not an editable profile page.`);
add('## Appendix E. Screenshot placement checklist\n\nUse actual authorized test builds and synthetic/consented records. Every item below corresponds to a caption in the manual. The separate CaterConnect_SCREENSHOT_CHECKLIST.md expands privacy, state and acceptance instructions. No screenshots were generated.\n\n'+table(['Figure','Capture','Role','Location'],screenshots.map(s=>[s.id,s.title,s.role,s.route])));
const inspected=[...new Set([...sources,M+'package.json',M+'app.json',M+'AGENTS.md','caterconnect-web/package.json','AGENTS.md'])].sort();
// Read every listed source to inventory actual bytes and capture a reproducible digest.
const digest=crypto.createHash('sha256');for(const f of inspected){digest.update(f+'\n');digest.update(read(f));}
const evidenceDigest=digest.digest('hex');
add(`## Appendix F. Source evidence and verification record\n\n### F.1. Scope and limits\n\nThe source inventory contains ${inspected.length} files read for routing, labels, actions, imports, backend calls, rule extraction or proposal/catalog reference checks. Styles, remaining templates and unused helper files are inventoried, not automatically promoted to user features. Authoritative live Supabase/Xendit inspection was not performed for this documentation task. Catalog exports are snapshots; SQL under proposals, including EXECUTE copies, is not evidence of installation. Missing deployed refund endpoint bodies are explicitly marked UNVERIFIED.\n\nCombined source-path/content SHA-256 at generation: ${evidenceDigest}. This digest identifies the local evidence set, not a signed release or a security certificate. No credentials, environment values, private table rows or full provider/customer objects are included.\n\n### F.2. Important evidence families\n\n- Navigation: mobile role layouts/root layout and web App.tsx/Sidebar.tsx.\n- Authentication: mobile/web auth helpers, Register/Login/VerifyEmail and profile contexts.\n- Booking/pricing: wizard, both booking screens, packagePricing, availability/monthly helpers and reviewed SQL.\n- Provider payments: xendit-payment, xendit-webhook, xendit-check-status and their helpers; original exported activate_paid_subscription/staff_correct_subscription_plan bodies.\n- Refunds: mobile callers, Staff read-only monitoring, refund-transfer catalog, saved notification/deadline/protection triggers.\n- Privacy: Internal Notes RPCs/private storage proposal, profile modal direct queries, message reactions whole-map helper and policy snapshots.\n- Administration: Staff provisioning endpoint/finalizer proposals, role assignment RPC proposal, maintenance/monitoring/audit pages.\n\n### F.3. Inspected source-file list\n\n${inspected.map(f=>'- `'+f+'`').join('\n')}\n\n### F.4. Final manuscript acceptance record\n\nComplete the following privately before final submission:\n\n${table(['Check','Result/evidence to record'],[
['Customer demonstration','Build/date; signup, actual email configuration, filtering, wizard quotation, saved booking, payment and review outcomes'],
['Caterer demonstration','Verification state, menu/package publication, capacity/quota, private notes, refund proof and subscription history'],
['Staff demonstration','Authorized routes, signed document/proof access, complaint persistence, read-only refund boundaries and reason/audit moderation'],
['Administrator demonstration','New Staff provisioning without conversion, restricted role updates, CSV row counts, activity filters and maintenance recovery'],
['Backend deployment confirmation','Actual installed RPC/trigger/RLS/storage versions; provider test mode; absent refund endpoint source reviewed separately'],
['Payment/refund acceptance','Explicitly authorized test transactions only; provider plus saved state, duplicate no-op, failed-state rejection and real receipt confirmation'],
['Screenshots','Figure ID, capture date/build, permission/consent and redaction completed'],
['Print review','Update Word fields/TOC, verify page numbers, readable table wrapping and figure placement after screenshots']
])}\n\nThis document is comprehensive source-based guidance, not a claim that all CONDITIONAL or UNVERIFIED features passed device/live acceptance.`);
const manual=chunks.join('\n').replace('Role management operates on existing Staff/Admin identities through a dedicated RPC, with self/last-admin safeguards in the reviewed proposal.','The role-management UI lists existing Staff/Admin identities and uses a dedicated RPC. The reviewed proposal requires an active administrator and blocks self changes and business-account conversion; its broader target-role scope is not equivalent to an exclusive existing-Staff/Admin backend restriction.');
fs.writeFileSync(path.join(out,'CaterConnect_COMPLETE_SYSTEM_USER_MANUAL.md'),manual,'utf8');
const unsupported=[
['Customer / Caterer','Forgot password/password recovery','Login screens','UNVERIFIED','Control has no active recovery handler.',S+'LoginScreen.tsx; '+web('Login')],
['All roles','Consultation inbox/live Staff consultation','No current route','UNVERIFIED','Consultation files/routes absent; booking chat is a different feature.',W+'App.tsx; '+A+'(tabs)/_layout.tsx; '+A+'(caterer)/_layout.tsx'],
['Customer / Caterer / Staff','Complete non-Xendit booking receipt review','No complete current screen flow','UNVERIFIED','Legacy fields/helper do not establish active UI.',E+'xendit-webhook/record-booking-callback.ts; '+cb+'; '+catb],
['Staff / Administrator','Send refunds or confirm customer receipt','Refund Monitoring','UNVERIFIED','Current screen is read-only; caterer transfers/customer confirms.',web('staff/RefundManagement')],
['Staff / Administrator','Self-service profile/password or notification page','No current route','UNVERIFIED','Sidebar name card is display only.',W+'App.tsx; '+W+'components/Sidebar.tsx'],
['Customer / Caterer','Protected later refund-destination form','Cancelled booking missing-destination notice','PLANNED','Screen explicitly waits for protected endpoint; no supplied implementation.',cb],
['Caterer','Narrow-RPC customer-profile integration','Customer Profile modal','PLANNED','RPC helper/proposal exists but current modal reads profiles directly.',M+'components/ConversationCustomerProfile.tsx; '+L+'bookingConversationProfile.ts'],
['All roles','Durable legal consent audit history','Registration policy text/metadata','UNVERIFIED','Metadata/checkbox confirmed; installed acceptance-history workflow not established.',L+'auth.ts; '+M+'constants/registrationPolicies.ts']
];
const stats=Object.keys(roleChapter).map(role=>({role,total:features.filter(f=>f.role===role).length,implemented:features.filter(f=>f.role===role&&f.status==='IMPLEMENTED').length,conditional:features.filter(f=>f.role===role&&f.status==='CONDITIONAL').length}));
for(const f of features)for(const source of f.source)if(!fs.existsSync(path.join(root,source)))throw Error('Missing feature source: '+source);
if(new Set(features.map(f=>f.id)).size!==features.length||new Set(screenshots.map(s=>s.id)).size!==screenshots.length)throw Error('Duplicate evidence ID');
if((manual.match(/^# CHAPTER /gm)||[]).length!==12)throw Error('Missing chapter');
if((manual.match(/^\*\*Purpose:\*\*/gm)||[]).length!==features.length)throw Error('Procedure format incomplete');
const matrix=`# CaterConnect — Feature Verification Matrix\n\nSource review: 20 October 2026 (Asia/Manila). Status describes source evidence, not a live deployment certificate. Procedure counts exclude the absent/planned rows below. No application/database code changed.\n\n${table(['Role','Procedure entries','IMPLEMENTED','CONDITIONAL'],stats.map(s=>[s.role,s.total,s.implemented,s.conditional]))}\n\n## Verification definitions\n\nIMPLEMENTED: actionable local path confirmed. CONDITIONAL: path exists with unresolved deployment/state/access conditions. PLANNED: proposal/intended path not connected as a working current workflow. UNVERIFIED: cannot establish availability or completion. No unsupported feature is presented as a successful user procedure.\n\n## Documented procedures\n\n${table(['ID / section','Role','Feature','Screen/route','Source file(s)','Status','Conditions / limits'],features.map(f=>[f.id+' / '+f.number,f.role,f.title,f.route||'Role screen described in manual',f.source.map(s=>'`'+s+'`').join('; '),f.status,f.notes]))}\n\n## Requested but absent, unconnected or unverified capabilities\n\n${table(['Role','Feature','Screen/route','Status','Evidence/condition','Related source'],unsupported)}\n\n## Conflicts requiring review before removing caveats\n\n${table(['Area','Classification','Finding'],limitations)}\n\n## Evidence scope\n\n${inspected.length} source files inventoried. Combined source SHA-256: ${evidenceDigest}. The complete file list is in manual Appendix F. No live Supabase/Xendit requests, SQL execution, deployment, credentials or real payment records were involved. Customer profile uses direct RLS-controlled reads in the current component; the unused narrow-RPC helper is not claimed as active. The original subscription RPC body is available in the supplied catalog export; missing refund endpoint bodies are not.\n`;
fs.writeFileSync(path.join(out,'CaterConnect_FEATURE_VERIFICATION_MATRIX.md'),matrix,'utf8');
const checklist=`# CaterConnect — Actual Screenshot and Acceptance Checklist\n\nReview date: 20 October 2026 (Asia/Manila). ${screenshots.length} numbered figure placements; some placements combine two related views and may need panels (a)/(b). Capture from the real authorized build, never an invented mockup.\n\n## Capture protocol\n\n1. Record the app/web build, device/browser, date and role privately.\n2. Use synthetic or consented accounts. Remove real names, addresses, phone numbers, email addresses, document numbers, bank/wallet destinations and transaction IDs. Never capture credentials, tokens, OTPs or secret dashboards.\n3. Open the actual route and perform only authorized operations. Do not initiate a payment, create Staff or change maintenance in production solely for a screenshot.\n4. Include the real action labels and state needed to support the procedure. If a feature is unavailable, capture the actual error and keep its CONDITIONAL label.\n5. Use portrait mobile images and legible desktop portal images. Retain the original redacted capture for provenance; do not alter interface labels.\n6. Replace the corresponding manual placeholder and keep the figure number/caption. For multipanel captures use (a)/(b) under the same number. Provide accessible alternative text.\n7. Update all Word fields/contents/page numbers and repaginate after insertion. Recheck table wrapping and captions.\n\n## Figure checklist\n\n${table(['Done','Figure','Caption','Role / route','Required evidence'],screenshots.map(s=>['[ ]',s.id,s.title,s.role+' / '+s.route,s.capture]))}\n\n## Additional state evidence for acceptance\n\n- [ ] Customer: empty search, invalid guest bounds, blocked/full date, add-on quantity, fractional-rate total and saved quote match.\n- [ ] Payment: authenticated provider-confirmed success AND correct committed record; pending/failure has no false paid state; duplicate has no new receipt/term. Only run authorized test payments.\n- [ ] Subscription: active Basic/Standard/Premium example, expiry from receipt + 30 days, effective quota on expiry, history/channel fallback and no manual normal approval.\n- [ ] Refund: pending, overdue if safely reproducible, proof-awaiting-customer, missing destination, dispute response and processed only after actual test receipt.\n- [ ] Chat: send/reload, photo, emoji draft, reaction toggle/removal/failure, simultaneous-account synchronization and RLS denial; do not certify unresolved whole-map races.\n- [ ] Profile: authorized booking access, Not provided fields and another account’s denial; privacy depends on actual deployed RLS.\n- [ ] Notes: assigned caterer save/edit/clear/reload and stale revision; customer/other-caterer denial.\n- [ ] Staff: actual document previews, complaint state persists, refund screen has no disbursement controls; audit/reason actions only if installed.\n- [ ] Admin: create only a new Staff identity, reject existing-email conversion and non-admin caller, preserve role safeguards; no production account creation for evidence without authorization.\n- [ ] Reports: Admin CSV at most 200 recent rows, rolling revenue windows, date-base definitions and no settlement claim.\n- [ ] Maintenance and signout: approved test notice, gate recovery, accessible support outside a blocked app and session cleared.\n- [ ] Verify all visible labels against the final demonstration build; update source-based caveats only after evidence review.\n\n## Acceptance worksheet\n\n| Feature/figure | Tester/role | Build and date | Test environment | Observed result | Redaction complete | Follow-up |\n| --- | --- | --- | --- | --- | --- | --- |\n| [Complete during authorized testing] | | | | | | |\n\nNo device screenshots or live acceptance results were produced during documentation generation.\n`;
fs.writeFileSync(path.join(out,'CaterConnect_SCREENSHOT_CHECKLIST.md'),checklist,'utf8');
const docx=makeDocx(manual);
fs.writeFileSync(path.join(out,'CaterConnect_COMPLETE_SYSTEM_USER_MANUAL.docx'),docx);
console.log(JSON.stringify({files:4,features:stats,figurePlacements:screenshots.length,sourceFiles:inspected.length,words:manual.split(/\s+/).length,docxBytes:docx.length,sourceDigest:evidenceDigest},null,2));
}

function makeDocx(markdown){
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const text=s=>s.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1');
let bookmark=0;
function runs(s,size){return text(s).split(/(\*\*[^*]+\*\*|`[^`]+`)/).filter(Boolean).map(part=>{
 const bold=part.startsWith('**'),code=part.startsWith('`');const v=bold?part.slice(2,-2):code?part.slice(1,-1):part;
 return `<w:r><w:rPr>${bold?'<w:b/>':''}${code?'<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="18"/>':size?`<w:sz w:val="${size}"/>`:''}</w:rPr><w:t xml:space="preserve">${esc(v)}</w:t></w:r>`;
}).join('');}
const paragraph=(s,style='Normal',extra='',size)=>`<w:p><w:pPr><w:pStyle w:val="${style}"/>${extra}</w:pPr>${runs(s,size)}</w:p>`;
const field=code=>`<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${code} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
const lines=markdown.split(/\r?\n/),body=[];let i=0;
while(i<lines.length){let line=lines[i];if(!line.trim()){i++;continue;}
 if(line.startsWith('| ')){
  const rows=[];while(i<lines.length&&lines[i].startsWith('| ')){if(!/^\|[\s:|\-]+\|$/.test(lines[i]))rows.push(lines[i].split('|').slice(1,-1).map(c=>c.trim()));i++;}
  const width=Math.floor(9360/Math.max(1,rows[0].length));
  body.push(`<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(v=>`<w:${v} w:val="single" w:sz="4" w:color="D1D5DB"/>`).join('')}</w:tblBorders><w:tblCellMar><w:top w:w="70" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${rows[0].map(()=>`<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>${rows.map((r,j)=>`<w:tr><w:trPr>${j===0?'<w:tblHeader/>':''}</w:trPr>${r.map(c=>`<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${j===0?'<w:shd w:fill="FFF7ED"/>':''}</w:tcPr>${paragraph(j===0?'**'+c+'**':c,'TableText','',18)}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`);continue;
 }
 const heading=line.match(/^(#{1,6})\s+(.+)$/);if(heading){const title=heading[2],level=Math.min(3,heading[1].length);const style=heading[1].length===1&&!title.startsWith('CHAPTER')?'Title':title==='COMPLETE SYSTEM USER MANUAL'?'Subtitle':'Heading'+level;
  const id=++bookmark;body.push(`<w:p><w:pPr><w:pStyle w:val="${style}"/>${title.startsWith('CHAPTER')||['Document control and reading convention','Table of contents'].includes(title)?'<w:pageBreakBefore/>':''}</w:pPr><w:bookmarkStart w:id="${id}" w:name="section${id}"/>${runs(title)}<w:bookmarkEnd w:id="${id}"/></w:p>`);
  if(title==='Table of contents'){body.push(`<w:p>${field('TOC \\o "1-3" \\h \\z \\u')}</w:p>`);}
  i++;continue;
 }
 if(/^\*\*Figure \d+\.\d+\./.test(line)){body.push(paragraph(line,'Caption','<w:keepNext/>'));i++;continue;}
 if(line.startsWith('[Insert actual screenshot')){body.push(paragraph(line,'Screenshot','<w:spacing w:before="100" w:after="180"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:color="D1D5DB"/></w:pBdr>'));i++;continue;}
 if(/^\d+\.\s/.test(line)||line.startsWith('- ')){body.push(paragraph(line,'ListParagraph'));i++;continue;}
 let block=line;while(i+1<lines.length&&lines[i+1].trim()&&!/^(#|\| |- |\d+\.\s|\*\*Figure|\[Insert)/.test(lines[i+1])&&!block.endsWith('  ')){block+=' '+lines[++i].trim();}
 body.push(paragraph(block));i++;
}
const relns='http://schemas.openxmlformats.org/package/2006/relationships';
const xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const parts={
'[Content_Types].xml':xml+`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${[['/word/document.xml','document.main'],['/word/styles.xml','styles'],['/word/settings.xml','settings'],['/word/footer1.xml','footer']].map(([p,t])=>`<Override PartName="${p}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${t}+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
'_rels/.rels':xml+`<Relationships xmlns="${relns}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
'word/_rels/document.xml.rels':xml+`<Relationships xmlns="${relns}">${[['styles','styles.xml'],['settings','settings.xml'],['footer','footer1.xml']].map(([t,p],n)=>`<Relationship Id="rId${n+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${t}" Target="${p}"/>`).join('')}</Relationships>`,
'word/document.xml':xml+`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body.join('')}<w:sectPr><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1273" w:bottom="1440" w:left="1273" w:header="720" w:footer="720"/><w:pgNumType w:start="1"/></w:sectPr></w:body></w:document>`,
'word/footer1.xml':xml+`<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr>${runs('CaterConnect System User Manual | Page ')}${field('PAGE')}${runs(' of ')}${field('NUMPAGES')}</w:p></w:ftr>`,
'word/settings.xml':xml+'<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:updateFields w:val="true"/><w:defaultTabStop w:val="720"/><w:compat/></w:settings>',
'word/styles.xml':xml+`<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/><w:lang w:val="en-PH"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/><w:widowControl/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>${[['Title',36],['Subtitle',28],['Heading1',30],['Heading2',27],['Heading3',25]].map(([n,s],j)=>`<w:style w:type="paragraph" w:styleId="${n}"><w:name w:val="${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="160"/>${n.startsWith('Heading')?`<w:outlineLvl w:val="${Number(n.slice(-1))-1}"/>`:''}</w:pPr><w:rPr><w:b/><w:color w:val="${n==='Heading1'?'C2410C':'111827'}"/><w:sz w:val="${s}"/></w:rPr></w:style>`).join('')}<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="300" w:hanging="300"/><w:spacing w:after="70"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="40" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="18"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="Caption"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Screenshot"><w:name w:val="Screenshot Placeholder"/><w:basedOn w:val="Normal"/><w:rPr><w:i/><w:color w:val="6B7280"/><w:sz w:val="22"/></w:rPr></w:style></w:styles>`,
'docProps/core.xml':xml+'<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>CaterConnect Complete System User Manual</dc:title><dc:subject>Source-based BSIT capstone user manual</dc:subject><dc:creator>CaterConnect Capstone Documentation</dc:creator><dc:description>Reviewed source edition; screenshot placeholders and deployment conditions retained.</dc:description><dcterms:created xsi:type="dcterms:W3CDTF">2026-10-20T00:00:00Z</dcterms:created></cp:coreProperties>'
};
return zip(parts);
}
function zip(parts){
 const table=Array.from({length:256},(_,n)=>{let c=n;for(let j=0;j<8;j++)c=c&1?0xEDB88320^(c>>>1):c>>>1;return c>>>0;});
 const crc=b=>{let c=0xFFFFFFFF;for(const x of b)c=table[(c^x)&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0;};
 const local=[],central=[];let offset=0;
 for(const [name,value]of Object.entries(parts)){const n=Buffer.from(name),raw=Buffer.from(value),compressed=zlib.deflateRawSync(raw),sum=crc(raw),h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(8,8);h.writeUInt16LE(((2026-1980)<<9)|(10<<5)|20,12);h.writeUInt32LE(sum,14);h.writeUInt32LE(compressed.length,18);h.writeUInt32LE(raw.length,22);h.writeUInt16LE(n.length,26);local.push(h,n,compressed);
 const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(8,10);c.writeUInt16LE(((2026-1980)<<9)|(10<<5)|20,14);c.writeUInt32LE(sum,16);c.writeUInt32LE(compressed.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);central.push(c,n);offset+=h.length+n.length+compressed.length;}
 const dir=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(parts).length,8);end.writeUInt16LE(Object.keys(parts).length,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,dir,end]);
}
