# Your Message Here

Absolutely. I’d use this as the single master prompt and have Lovable build from it, rather than feeding it the incremental prompts.

Build a complete, production-ready website called Your Message Here.

Domain:

yourmessagehere.co

The site is a radically simple internet billboard auction.

1. CORE CONCEPT

There is one billboard on the internet.

Advertisers bid throughout the week to own the billboard for the following 7-day period.

Every auction ends at exactly:

10:00 PM every Friday, New York City time

The highest bidder wins.

Only after the auction ends does the winning bidder go to Stripe to pay their winning bid.

The winner then uploads their billboard creative, it is approved by admin, and it occupies the billboard for their allocated week.

The concept should be understandable within approximately three seconds:

One billboard. One week. Highest bidder wins.

Do not turn this into an advertising marketplace.

There is:

* one billboard
* one live advertiser
* one auction for the next slot
* one winner every Friday

The simplicity is the product.

⸻

2. TECH STACK

Use:

* React
* TypeScript
* Tailwind
* existing Rocket Supabase project
* Supabase PostgreSQL
* Supabase Realtime
* Supabase Storage
* Supabase Edge Functions
* Stripe Checkout
* Stripe Webhooks
* Resend

CRITICAL SUPABASE REQUIREMENT

DO NOT USE LOVABLE CLOUD.

DO NOT CREATE A NEW SUPABASE PROJECT.

Connect this project to the existing Supabase project already used by Rocket.

I will connect/provide the existing Rocket Supabase project credentials and necessary secrets.

Before making migrations, inspect the existing Supabase schema.

Do not modify, rename, delete, overwrite, or interfere with existing Rocket:

* tables
* users
* authentication
* functions
* Edge Functions
* storage
* policies
* Stripe logic
* application data

Your Message Here should share Rocket’s infrastructure while remaining logically isolated.

⸻

3. DATABASE NAMESPACING

Prefix Your Message Here resources with:

ymh_

Create:

ymh_auctions

Fields:

* id
* slot_start
* slot_end
* bidding_start
* bidding_end
* starting_bid
* minimum_increment
* current_highest_bid
* winning_bid_id
* status
* created_at

Statuses:

* upcoming
* open
* awaiting_payment
* completed
* cancelled

ymh_bids

Fields:

* id
* auction_id
* bidder_name
* bidder_email
* advertiser_name
* destination_url
* amount
* status
* source
* created_at
* stripe_checkout_session_id
* payment_deadline
* paid_at

Set:

source = "your_message_here"

Statuses:

* active
* outbid
* provisional_winner
* winner_paid
* payment_expired
* disqualified

ymh_billboards

Fields:

* id
* auction_id
* winning_bid_id
* advertiser_name
* destination_url
* creative_url
* alt_text
* start_at
* end_at
* moderation_status
* created_at

ymh_email_events

Fields:

* id
* recipient
* email_type
* auction_id
* bid_id
* resend_email_id
* status
* created_at

Use this for email idempotency and to prevent duplicate transactional emails.

ymh_settings

Store configurable values including:

* starting bid
* minimum bid increment
* winner payment deadline
* admin email
* other auction settings

Do not hardcode settings that should be configurable.

⸻

4. DESIGN DIRECTION

The website should be radically minimal.

Use a completely white background.

Visual direction:

Swiss typography × physical roadside billboard × early internet simplicity

Use:

* white
* black
* subtle gray
* clean sans-serif typography such as Inter or Helvetica
* lots of negative space
* minimal borders
* minimal UI

The advertiser’s creative should provide almost all of the color on the homepage.

Do NOT use:

* gradients
* colorful backgrounds
* excessive rounded cards
* giant shadows
* feature grids
* testimonials
* pricing cards
* traditional SaaS hero sections
* unnecessary navigation
* dashboard-style homepage elements
* excessive explanatory copy

Do not make this look like a SaaS landing page.

The billboard is the website.

⸻

5. HOMEPAGE /

The homepage must be extremely clean.

It should NOT contain the bidding form.

It should NOT contain detailed auction mechanics.

It should NOT contain a bid history.

Header

Top left:

Your Message Here

Top right:

CURRENT BID

$240

ENDS IN

02D : 13H : 42M : 19S

The amount and countdown should be compact and elegantly presented.

The countdown updates every second.

The current bid updates live using Supabase Realtime.

Main billboard

Create a huge physical billboard-style frame as the dominant visual element.

It should look like an actual outdoor billboard.

Include:

* large landscape advertising surface
* approximately 16:9 proportions
* thin dark/black frame
* physical supports / legs underneath
* very subtle structural details
* lots of white space around it

Do not make it look like an image inside a web card.

On desktop it should occupy a large portion of the screen.

The active advertiser’s creative fills the billboard advertising surface.

Clicking the billboard opens the advertiser’s destination URL in a new tab.

Empty billboard

If there is no active advertiser, display:

YOUR
MESSAGE
HERE

in huge bold black typography inside the billboard.

Make this default state feel iconic.

Below billboard

Display:

One billboard. One week. Highest bidder wins.

Then one prominent black button:

Buy this billboard →

Clicking this button navigates to:

/buy

Do NOT open a modal.

Do NOT label the homepage CTA “Place a bid.”

The homepage sells the object.

The /buy page explains the auction.

⸻

6. /BUY PAGE

Create a dedicated:

/buy

page.

This contains the auction and bidding functionality.

Maintain exactly the same minimal black-and-white visual language.

Top left:

Your Message Here

Clicking it returns to /.

Main heading:

Buy this billboard.

Supporting text:

One billboard. One week. Highest bidder wins.

Prominently show:

CURRENT BID

$240

AUCTION ENDS IN

02D : 13H : 42M : 19S

Then:

Friday, 10:00 PM New York

Current bid must update live using Supabase Realtime.

⸻

7. BID FORM

Below the auction information:

Place your bid

Show:

Current bid: $240

Minimum bid: $250

Fields:

Your bid

Currency input.

Name

Email

Company / advertiser

Website

Button:

Place bid →

Underneath:

No payment required now. If you win, you’ll have 24 hours to pay via Stripe.

Do NOT collect:

* payment information
* card information
* Stripe information
* billboard creative

at the bidding stage.

Do NOT require an account.

The bidding experience should be extremely low friction.

⸻

8. BID RULES

Default starting bid:

$50

Default minimum increment:

$10

Make both configurable in ymh_settings.

Every bid must be validated server-side.

Before accepting a bid:

1. Confirm the auction is still open.
2. Retrieve the authoritative current highest bid.
3. Calculate the actual minimum bid.
4. Confirm the submitted amount meets the requirement.
5. Save the bid transactionally.
6. Mark the previous highest bid as outbid if necessary.
7. Update the auction’s highest bid.
8. Return confirmation.

Never trust the current bid displayed by the frontend.

Never trust frontend validation alone.

Handle simultaneous bids safely.

The database/server must be authoritative.

⸻

9. AFTER PLACING A BID

After a valid bid, show:

You’re the highest bidder.

Your bid: $250

We’ll email you if someone beats your bid.

If you’re still the highest bidder when the auction closes Friday at 10 PM New York time, you win.

Include:

Back to billboard →

Do not require account creation.

Send a bid confirmation email through Resend.

⸻

10. LIVE BIDDING

Use Supabase Realtime.

When a higher bid is placed:

$240

should become:

$300

automatically for visitors viewing either:

/

or:

/buy

No refresh should be necessary.

Update the minimum bid requirement on /buy as well.

⸻

11. FIXED AUCTION SCHEDULE

Every auction ends at exactly:

10:00 PM every Friday, New York City time

Use:

America/New_York

Do NOT use a fixed UTC offset.

The system must correctly account for EST and EDT.

All authoritative timing must be server-side.

The browser countdown is visual only.

The server-side bidding_end timestamp determines whether a bid is valid.

A bid successfully received before 10:00:00 PM may be accepted.

A bid received at or after 10:00:00 PM must be rejected.

NO ANTI-SNIPING

Do NOT extend auctions.

10 PM Friday New York time is a hard deadline.

Someone can bid at the last second if they want.

⸻

12. CONTINUOUS WEEKLY MODEL

The current advertiser occupies the billboard while people bid for the next billboard slot.

Example:

Advertiser A is currently live for this week’s period.

At the same time, advertisers are bidding to own next week’s period.

Every Friday at 10 PM New York time:

Auction closes → Highest bidder wins → Winner asked to pay → New auction opens

The new auction should open automatically.

There should therefore normally always be:

* one current billboard
* one current auction

⸻

13. AUCTION END

At exactly 10 PM Friday New York time:

1. Lock the current auction.
2. Reject further bids.
3. Determine the highest valid bidder.
4. Mark them provisional_winner.
5. Change auction to awaiting_payment.
6. Generate a secure way for the winner to pay.
7. Send winner email through Resend.
8. Create/open the next weekly auction.

Do NOT automatically charge anyone.

⸻

14. WINNER EXPERIENCE

The winning bidder should be able to access a secure winner/payment page.

Display:

You won.

Winning bid

$420

You won the billboard for 7 days.

Complete payment to claim your billboard.

Pay $420 →

The winner should have:

24 hours

to pay by default.

Show:

Payment due in 23:41:08

Make the deadline configurable.

⸻

15. STRIPE

Only use Stripe AFTER somebody wins.

Flow:

Bid → Win → Stripe Checkout → Upload creative → Billboard

Do not collect payment details during bidding.

When the winner clicks:

Pay $420 →

call a dedicated Supabase Edge Function.

The Edge Function must retrieve the authoritative winning bid amount from Supabase.

Never send a user-editable amount directly to Stripe.

Create a Stripe Checkout Session for exactly that amount.

Use metadata:

product_source: "your_message_here"

plus:

* auction_id
* bid_id

Never expose Stripe secret keys client-side.

Use Stripe webhooks to verify successful payment.

Do not trust the Stripe success redirect alone.

⸻

16. IF WINNER DOESN’T PAY

If payment is not completed within the configured payment deadline:

1. Mark bid payment_expired.
2. Identify the next-highest eligible bidder.
3. Mark them provisional_winner.
4. Email them.
5. Give them the same payment window.
6. Allow them to pay their own bid amount.

Continue down the ranking until someone pays.

Nobody is automatically charged.

⸻

17. CREATIVE UPLOAD

Only request billboard creative after successful payment.

Collect:

* billboard image
* destination URL
* alt text / description

Support:

* JPG
* PNG
* WebP

Recommend:

16:9

Show the advertiser a preview inside the actual billboard frame.

Create a dedicated Supabase Storage bucket:

ymh-billboard-creatives

Do not use existing Rocket storage buckets.

⸻

18. MODERATION

Do not automatically publish uploaded advertising.

After submission show:

Your billboard is being reviewed.

Notify admin through Resend.

Admin can:

* preview
* approve
* reject

If rejected, email the advertiser and allow them to submit a replacement.

Once approved, schedule the billboard for the advertiser’s allocated period.

⸻

19. RESEND

Integrate Resend for transactional emails.

Use Supabase Edge Functions to send emails securely.

Store the Resend API key as a server-side environment secret.

Never expose it client-side.

Once the domain is verified, use:

Your Message Here hello@yourmessagehere.co⁠￼

Keep email design extremely simple and consistent with the website:

* white background
* black typography
* minimal styling
* mobile friendly

⸻

20. BID CONFIRMATION EMAIL

Subject:

Your bid is in

Content:

You’re in.

Your bid: $250

The auction ends Friday at 10 PM New York time.

We’ll email you if you’re outbid or if you win.

View billboard →

⸻

21. OUTBID EMAIL

When the current highest bidder is overtaken:

Subject:

You’ve been outbid

Content:

Someone beat your bid.

Your bid: $250

Current bid: $300

Auction ends Friday at 10 PM New York time.

Bid again →

Do not send repeated emails for every subsequent bid.

Send an outbid email when a bidder transitions from current winner to outbid.

⸻

22. WINNER EMAIL

At auction close:

Subject:

You won the billboard

Content:

You won.

Winning bid: $420

You have 24 hours to complete payment and claim next week’s billboard.

Pay $420 →

If payment is not completed before the deadline, the billboard will be offered to the next-highest bidder.

⸻

23. PAYMENT REMINDER

If payment has not been completed and the deadline is approaching:

Subject:

Your billboard is waiting

Content:

You won this week’s billboard auction for $420.

Complete payment before your deadline to claim it.

Pay now →

Do not spam the winner with reminders.

⸻

24. PAYMENT CONFIRMATION

After Stripe webhook confirms payment:

Subject:

The billboard is yours

Content:

You’re officially on the billboard.

Payment received: $420

Now upload your billboard creative.

Upload creative →

⸻

25. CREATIVE EMAILS

After creative upload:

Subject:

We got your billboard

Tell them it is being reviewed.

After approval:

Subject:

Your billboard is ready

Include their scheduled dates.

After rejection:

Subject:

We need a new creative

Include a secure:

Upload replacement →

link.

⸻

26. RUNNER-UP EMAIL

If the previous winner fails to pay:

Subject:

The billboard is yours if you want it

Content:

The winning bidder didn’t complete their purchase.

Your bid of $390 is now eligible to win the billboard.

Complete payment within the stated deadline.

Pay $390 →

⸻

27. BILLBOARD LIVE EMAIL

When their billboard actually becomes active:

Subject:

You’re live

Content:

Your billboard is live.

Your advertisement is now occupying Your Message Here.

Include their scheduled end date.

View your billboard →

⸻

28. ADMIN EMAILS

Notify admin through Resend when:

* auction closes
* winner selected
* payment succeeds
* payment expires
* creative is uploaded
* creative needs review
* important Stripe errors occur
* important auction errors occur

Do NOT email admin for every bid.

⸻

29. EMAIL IDEMPOTENCY

Use ymh_email_events.

Webhook and automated processes must be idempotent.

Never accidentally send:

* two winner emails
* two payment confirmations
* duplicate outbid emails
* duplicate admin alerts

if a function or webhook retries.

⸻

30. ADMIN

Create a protected:

/admin

page.

This can use secure admin authentication.

Allow admin to:

* view live billboard
* preview billboard
* view current auction
* see current highest bid
* see all bids
* see bidder contact details
* see auction end time
* manually close an auction
* disqualify a bid
* change starting bid
* change minimum increment
* change payment deadline
* see winner
* see Stripe payment status
* preview creative
* approve creative
* reject creative
* remove an advertisement
* view auction history
* view previous winning bids
* resend important transactional emails where appropriate

Keep the admin functional and simple.

Do not spend unnecessary design effort here.

⸻

31. MOBILE

Mobile is extremely important.

Support screens from approximately 320px upward.

Homepage mobile hierarchy

Your Message Here

Current bid + countdown

Billboard

One billboard. One week. Highest bidder wins.

Buy this billboard →

The billboard should occupy almost the entire available width.

Maintain the physical billboard proportions and supports.

Do not create horizontal scrolling.

/buy mobile hierarchy

Prioritize:

Current bid

Countdown

Bid amount

Contact details

Place bid →

Inputs and buttons must be easy to use on iPhone and Android.

Do not simply shrink the desktop design.

⸻

32. FOOTER

Keep the footer tiny.

Left:

© Your Message Here

Right:

Buy · Terms · Privacy

Buy links to:

/buy

No large footer.

⸻

33. ROCKET SUPABASE ISOLATION

Your Message Here uses the existing Rocket Supabase project, but the products should remain completely separate publicly.

Do NOT:

* display Rocket branding
* require Rocket authentication
* redirect users to Rocket
* automatically create Rocket accounts
* modify existing Rocket user records
* interfere with Rocket data

Use clear ymh_ naming for:

* tables
* database functions
* Edge Functions
* storage
* relevant policies

Possible Edge Function names:

* ymh-place-bid
* ymh-close-auction
* ymh-create-checkout
* ymh-stripe-webhook
* ymh-send-email

Do not modify existing Rocket Edge Functions unless absolutely necessary.

⸻

34. FUTURE ROCKET INTEGRATION

Architect Your Message Here so users can eventually be fed into Rocket.

Do NOT build this integration yet.

Store structured bidder/customer data including:

* email
* name
* company
* website
* bid amount
* auctions participated in
* whether they won
* whether they paid
* source
* created_at

Use:

source = "your_message_here"

This should make it possible later to add:

* Build your billboard with Rocket
* Rocket-generated billboard creatives
* advertiser onboarding into Rocket
* attribution of YMH customers inside Rocket
* Rocket branding tools for advertisers
* post-auction Rocket offers

Do not expose any of this on the current website.

⸻

35. SECURITY

Implement appropriate Supabase Row Level Security.

Public users should NEVER be able to retrieve:

* bidder email addresses
* private bidder details
* Stripe identifiers
* admin data

Sensitive actions must happen server-side.

Rate-limit or otherwise protect the bidding endpoint from obvious abuse.

Validate:

* email
* URL
* bid amount
* auction state

Sanitize user-controlled values.

Never trust frontend state for financial or auction logic.

⸻

36. CRITICAL PRODUCT RULES

Do NOT overbuild this.

Do not add:

* multiple billboards
* categories
* advertiser profiles
* bidder accounts
* public bidder leaderboards
* marketplace browsing
* analytics dashboards on the homepage
* unnecessary navigation
* long explanatory sections

The homepage should essentially be:

Your Message Here

CURRENT BID
$240

ENDS IN
02D : 13H : 42M

[HUGE PHYSICAL BILLBOARD]

One billboard. One week. Highest bidder wins.

Buy this billboard →

That’s it.

The billboard is the hero.

The homepage creates curiosity.

/buy handles the auction.

Every Friday at 10 PM New York time, somebody wins the next week.

Build the MVP around this idea and resist adding anything that makes the product feel more complicated.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/188ad99d-9190-45d4-9a96-55cd6d1f6b6b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
