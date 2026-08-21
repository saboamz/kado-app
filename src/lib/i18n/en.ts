import type { Dictionary } from './t';

/**
 * The English phrasebook.
 *
 * Typed as `Dictionary`, which is derived from fr.ts — so a key missing here,
 * or one that exists here and not in French, fails the build. That is the
 * whole safety net: there is no runtime fallback to French, because a
 * fallback is how a page silently stays half-translated for months.
 *
 * Translated for sense rather than word-for-word. "Vos proches" is the clearest
 * case: it means the people close to you, and "your loved ones" is stilted in
 * an app about buying someone a scarf, so it reads "friends and family" or
 * simply "friends" depending on the sentence.
 */
export const en: Dictionary = {
  // ── Navigation and chrome ────────────────────────────────────────────────
  'nav.main': 'Main navigation',
  'nav.skip': 'Skip to content',
  'nav.home': 'Home',
  'nav.lists': 'My lists',
  'nav.search': 'Search',
  'nav.alerts': 'Alerts',
  'nav.profile': 'Profile',
  'nav.unread': { one: '{count} unread notification', other: '{count} unread notifications' },

  // ── Shared words ─────────────────────────────────────────────────────────
  'common.seeAll': 'See all',
  'common.default': 'Default',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.back': 'Back',
  'common.wishes': { one: '{count} wish', other: '{count} wishes' },
  'common.lists': { one: '{count} list', other: '{count} lists' },
  'common.friends': { one: '{count} friend', other: '{count} friends' },
  'common.reserved': { one: '{count} already claimed', other: '{count} already claimed' },
  'common.results': { one: '{count} result', other: '{count} results' },

  // ── Landing ──────────────────────────────────────────────────────────────
  'landing.createAccount': 'Create my account',

  // ── Sign in / sign up ────────────────────────────────────────────────────
  'auth.welcomeBack': 'Good to see you again.',
  'auth.createYours': 'Create your account.',
  'auth.name': 'Name',
  'auth.email': 'Email address',
  'auth.password': 'Password',
  'auth.passwordHint': 'At least 8 characters.',
  'auth.signIn': 'Sign in',
  'auth.signUp': 'Create my account',
  'auth.createAccount': 'Create an account',

  // ── Home ─────────────────────────────────────────────────────────────────
  'home.greeting': 'Hello {name}',
  'home.subtitle': 'Your lists, and what your friends are planning.',
  'home.events': 'Coming up',
  'home.myLists': 'My lists',
  'home.aroundYou': 'Around you',
  'home.noListsTitle': 'No lists yet',
  'home.noListsBody':
    'Create a list and add what would make you happy. Your friends will know what to give.',
  'home.createList': 'Create a list',
  'home.noFriendsTitle': 'No friends yet',
  'home.noFriendsBody':
    'Invite your friends to see their lists and know what to give them.',
  'home.inviteFriends': 'Invite my friends',

  // ── Getting started ──────────────────────────────────────────────────────
  'onboarding.title': 'Getting started',
  'onboarding.progress': '{done} of {total} — a few minutes, no more.',
  'onboarding.dismiss': 'Hide',
  'onboarding.done': 'done',
  'onboarding.wishTitle': 'Add your first wish',
  'onboarding.wishBody': 'A link, a price, an idea — this is what your friends will come to read.',
  'onboarding.wishCta': 'Add a wish',
  'onboarding.friendTitle': 'Invite someone',
  'onboarding.friendBody': 'Your invitation link connects you directly, with no searching.',
  'onboarding.friendCta': 'Get my link',
  'onboarding.profileTitle': 'Complete your profile',
  'onboarding.profileBody':
    'Your interests: enough to guide anyone looking for an idea.',
  'onboarding.profileCta': 'Complete',
  'onboarding.decorationTitle': 'Decorate your profile',
  'onboarding.decorationBody': 'A GIF at the foot of the page, so your profile looks like you.',
  'onboarding.decorationCta': 'Choose a GIF',

  // ── Lists ────────────────────────────────────────────────────────────────
  'lists.title': 'My lists',
  'lists.subtitle': 'What you would like to receive, sorted by occasion.',
  'lists.emptyBody':
    'Create a list — a birthday, or simply what you feel like right now.',
  'lists.newList': 'New list',
  'lists.emptyListTitle': 'This list is empty',
  'lists.emptyListBody': 'Add what would make you happy.',
  'lists.addWish': 'Add a wish',
  'lists.theirLists': 'Their lists',
  'lists.noVisibleLists': 'No visible lists',

  // ── A wish ───────────────────────────────────────────────────────────────
  'gift.pot': 'Group gift',
  'gift.reservedByYou': 'Claimed by you',
  'gift.alreadyReserved': 'Already claimed',
  'gift.youReservedIt': 'You claimed it',
  'gift.sharedGift': 'Shared gift',
  'gift.friendsSide': 'The friends’ side',
  'gift.hiddenIfYouReserve': 'If you claim it, the list’s owner will never see it.',
  'gift.ownerSeesNothing': 'The list’s owner sees none of this.',

  // ── Friends and search ───────────────────────────────────────────────────
  'friends.title': 'My friends',
  'friends.subtitle': 'The people whose lists you see, and who see yours.',
  'friends.emptyBody': 'Add your friends to see their lists and know what to give them.',
  'friends.find': 'Find friends',
  'search.title': 'Search',
  'search.subtitle': 'Find your friends to see their lists.',
  'search.nobodyTitle': 'Nobody found',
  'search.nobodyBody': 'Try another name, or the person’s exact email address.',
  'search.suggestions': 'Suggestions',
  'search.noSuggestionsTitle': 'Nobody to suggest',
  'search.noSuggestionsBody': 'Look for your friends by name or by email address.',

  // ── Notifications ────────────────────────────────────────────────────────
  'notifications.title': 'Notifications',
  'notifications.markAll': 'Mark all as read',
  'notifications.markingAll': 'Marking…',
  'notifications.markAllFailed': 'Could not mark them read. Try again.',
  'notifications.emptyTitle': 'Nothing new',
  'notifications.emptyBody': 'Dates, new lists and friend requests will show up here.',
  'notifications.unread': 'Unread',

  // ── Events ───────────────────────────────────────────────────────────────
  'events.title': 'Coming up',
  'events.subtitle': 'The dates your friends chose to publish.',
  'events.emptyTitle': 'No dates coming up',
  'events.emptyBody':
    'Your friends have published no dates, or you have no friends yet.',
  'events.findPeople': 'Find people',
  'events.thisMonth': 'Within the month',
  'events.later': 'Later',
  'events.mine': 'My dates',
  'events.add': 'Add a date',
  'events.label': 'Name',
  'events.labelPlaceholder': 'Birthday, wedding, graduation…',
  'events.labelHint': 'You choose what you publish, and what to call it.',
  'events.day': 'Day',
  'events.month': 'Month',
  'events.visibility': 'Who can see it',
  'events.none': 'You have published no dates.',
  'events.delete': 'Remove',
  'events.adding': 'Adding…',

  // ── Profile and settings ─────────────────────────────────────────────────
  'profile.title': 'Profile',
  'profile.lists': 'Lists',
  'profile.wishes': 'Wishes',
  'profile.friends': 'Friends',
  'profile.interests': 'Interests',
  'profile.editTitle': 'Edit my profile',
  'profile.editSubtitle': 'What your friends see of you.',
  'profile.decorate': 'Decorate my profile',
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.languageHint': 'The language you read Kado in.',
  'settings.deleteAccount': 'Delete my account',

  // ── Forms ────────────────────────────────────────────────────────────────
  'form.giftName': 'What would make you happy?',
  'form.giftNamePlaceholder': 'AirPods Pro, a stoneware vase, a weekend away…',
  'form.link': 'Link',
  'form.linkPlaceholder': 'Optional — paste the shop’s link',
  'form.linkHint':
    'The shop, the photo and the price will be taken from the page if we can read it. If it refuses us, an outside reading service is asked for its name.',
  'form.price': 'Price',
  'form.optional': 'Optional',
  'form.category': 'Category',
  'form.choose': 'Choose…',
  'form.photo': 'Photo',
  'form.details': 'Details',
  'form.detailsPlaceholder': 'Size, colour, exact model…',
  'form.listName': 'List name',
  'form.listNamePlaceholder': 'Birthday, Wedding…',
  'form.occasion': 'Occasion',
  'form.avatar': 'Profile photo',
  'form.about': 'About',
  'form.aboutPlaceholder': 'What you like, in one sentence.',
  'form.interests': 'Interests',
  'form.interestsPlaceholder': 'Coffee, ceramics, hiking',
  'form.interestsHint': 'Separated by commas — enough to inspire your friends.',
  'form.appearance': 'Appearance',
  'form.privacy': 'Privacy',
  'form.publicProfile': 'Public profile',
  'visibility.friends': 'My friends',
  'visibility.friendsHint': 'Only your friends see this list.',
  'visibility.private': 'Nobody',
  'visibility.public': 'Everyone',
  'visibility.privateHint': 'Visible only to you, so you can plan in peace.',
  'visibility.publicHint': 'Available to anyone with the link.',

  // ── Actions and states ───────────────────────────────────────────────────
  'action.add': 'Add',
  'action.edit': 'Edit',
  'action.creating': 'Creating…',
  'action.saving': 'Saving…',
  'action.signingIn': 'Signing in…',
  'action.copied': 'Copied',
  'action.searching': 'Searching…',
  'action.loading': 'Loading…',
  'action.nothingYet': 'Nothing yet',

  // ── Reserving and pots ───────────────────────────────────────────────────
  'reserve.cta': 'I’ll get this one',
  'reserve.pending': 'Claiming…',
  'reserve.openToOthers': 'Invite others to chip in',
  'reserve.youOpened':
    'You opened this gift to the other guests. Chip in to the pot below.',
  'reserve.someoneOpened':
    'A friend opened this gift up to several people. You can chip in to the pot below.',
  'pot.nobodyYet': 'Nobody has chipped in yet.',
  'pot.quickAmounts': 'Quick amounts',
  'pot.amount': 'Amount',
  'chat.title': 'Secret chat',
  'chat.placeholder': 'I can put in 50 €…',

  // ── Lists and wishes, continued ──────────────────────────────────────────
  'lists.emptyListHint': 'Add a wish: a link, a price, or simply an idea.',
  'lists.newTitle': 'New list',
  'lists.newSubtitle': 'One list per occasion: a birthday, or what you fancy now.',
  'lists.create': 'Create the list',
  'lists.editTitle': 'Edit the list',
  'lists.deleteList': 'Delete this list',
  'gift.addTitle': 'Add a wish',
  'gift.addCta': 'Add to my list',
  'gift.adding': 'Adding…',
  'gift.editTitle': 'Edit this wish',
  'gift.deleteGift': 'Delete this wish',

  'friend.add': 'Add',
  'friend.accept': 'Accept',
  'friend.decline': 'Decline',
  'friend.remove': 'Remove',
  'friend.requestSent': 'Request sent',
  'form.whoCanSee': 'Who can see this list?',
  'form.howMuch': 'How much do you want it?',
  'priority.1': 'A passing idea',
  'priority.2': 'I’d rather like it',
  'priority.3': 'I’d love it',

  // ── Errors ───────────────────────────────────────────────────────────────
  'error.emailRequired': 'Enter your email address.',
  'error.emailInvalid': 'That email address does not look valid.',
  'error.passwordShort': 'The password must be at least 8 characters.',
  'error.passwordLong': 'That password is too long.',
  'error.passwordRequired': 'Enter your password.',
  'error.nameRequired': 'Enter your name.',
  'error.nameLong': 'That name is too long.',
  'error.textLong': 'That text is too long.',
  'error.giftNameRequired': 'Give this wish a name.',
  'error.listNameRequired': 'Give your list a name.',
  'error.eventLabelRequired': 'Give this date a name.',
  'error.eventDateInvalid': 'That date does not exist.',
  'error.eventTooMany': 'You have reached the maximum number of dates.',
  'error.eventNotFound': 'Date not found.',
  'error.categoryRequired': 'Choose a category.',
  'error.giftNotFound': 'Gift not found',
  'error.messageNotFound': 'Message not found.',
  'error.personNotFound': 'That person cannot be found.',
  'error.requestGone': 'That request no longer exists.',
  'error.relationGone': 'That connection no longer exists.',
  'error.alreadyFriends': 'You are already friends.',
  'error.requestAlreadySent': 'Request already sent.',
  'error.cannotAddYourself': 'You cannot add yourself.',
  'error.ownInviteLink': 'That is your own invitation link.',
  'error.inviteClosed': 'This invitation has been closed.',
  'error.inviteUnknown': 'This invitation does not exist.',
  'error.cannotReserveOwn': 'You cannot claim a gift from your own list.',
  'error.cannotContributeOwn': 'You cannot chip in to a pot on your own list.',
  'error.potComplete': 'The pot is already full. Thank you!',
  'error.amountInvalid': 'That amount does not look valid.',
  'error.amountTooHigh': 'That amount is too high.',
  'error.amountMinimum': 'The minimum is 1 €.',
  'error.unknownSlot': 'Unknown slot.',
  'error.imageUnreadable': 'That image cannot be read.',
  'error.imageNotAllowed': 'That image does not come from an allowed source.',
  'error.tryLater': 'Not possible right now.',

  'time.justNow': 'just now',
  'time.today': 'it’s today',
  'time.tomorrow': 'tomorrow',
  'time.inDays': 'in {count} days',
  'time.inOneMonth': 'in a month',
  'time.inMonths': 'in {count} months',

  'meta.invitation': 'Invitation',

  'pot.heading': 'Group pot',
  'pot.raisedOf': 'raised of {target}',
  'pot.participants': { one: '{count} person chipping in', other: '{count} people chipping in' },
  'pot.remaining': '{amount} to go',
  'pot.yourShare': 'Your share:',
  'pot.progress': 'Pot at {percent}%',
  'image.change': 'Change',
  'image.choose': 'Choose an image',
  'gif.close': 'Close',
  'gif.change': 'Change',
  'gif.remove': 'Remove',

  'settings.themeLight': 'Light',
  'settings.themeDark': 'Dark',
  'settings.currency': 'Currency',
  'settings.publicProfileHint':
    'Anyone with the link can see your profile and your public lists. What you have claimed stays private whatever happens.',
  'settings.saved': 'Your preferences have been saved.',

  'error.emailTaken': 'An account already exists with that address.',
  'error.badCredentials': 'Wrong email address or password.',
  'error.tooManyAttempts': 'Too many attempts. Try again in a few minutes.',
  'lists.defaultName': 'My wishes',

  'error.retryMinutes': {
    one: 'Too many attempts. Try again in a minute.',
    other: 'Too many attempts. Try again in {count} minutes.',
  },

  'chat.empty': 'No messages. Start the conversation.',
  'chat.yourMessage': 'Your message',
  'chat.send': 'Send',
  'chat.sending': 'Sending…',
  'delete.list': 'Delete the list',
  'delete.listConfirm': 'Delete the list “{name}” and all its wishes? This cannot be undone.',
  'delete.gift': 'Delete this wish',
  'delete.giftConfirm': 'Remove “{name}” from your list?',
  'reserve.cancel': 'Cancel my claim',
  'profile.friendsCount': 'My friends ({count})',
  'profile.noListsToShare': 'This person has no list to share yet.',
  'settings.deleteWarning': 'Your lists, your wishes and your messages will be permanently deleted.',
  'auth.signupLede': 'Your lists, your friends, and surprises that stay surprises.',

  'pot.contribute': 'Chip in',
  'pot.contributing': 'Sending…',
  'pot.withdraw': 'Withdraw my contribution',
  'pot.withdrawing': 'Withdrawing…',

  'gift.estimatedPrice': '~{price}',
  'gift.estimatedNote': 'Price read from the shop, as a guide — {name} did not give one.',

  'gift.potHiddenFromOwner': '{name} sees neither the total, nor who chipped in, nor that this pot exists at all.',

  'gift.estimatedNoteOwn': 'Price read from the shop, as a guide — you did not give one.',

  'gift.linkUnread': 'We could not read this page — some shops refuse robots. Add the price yourself if you like.',

  'pot.goalLabel': 'Pot goal',
  'pot.goalFromShop': 'Read from the shop. Correct it if the price has changed.',
  'pot.goalFree': 'Optional — with no goal the pot collects without ever calling itself complete.',
  'reserve.opening': 'Opening…',
  'reserve.takeBack': 'Take it back for myself',
  'reserve.mineNote': 'You claimed this gift. If it is expensive, open it to the other guests: everyone puts in what they like, and the owner still knows nothing.',
  'reserve.freeNote': 'The other guests will see it is taken, without knowing by whom. The owner sees nothing at all.',

  'error.notOpenToOthers': 'This gift is not open to several people.',
  'error.noAccessToList': 'You do not have access to this list.',
  'error.alreadyPurchased': 'Somebody has already taken care of it.',
  'error.contributeFirst': 'Chip in first to be able to buy it.',
  'pot.iBoughtIt': 'I’m the one buying it',
  'pot.declaring': 'Saving…',
  'pot.boughtByMe': 'You bought it. Here is what the others owe you.',
  'pot.boughtBy': '{name} bought it.',
  'pot.youOwe': 'You owe them {amount}.',
  'pot.nobodyOwes': 'Nobody owes you anything yet.',
  'pot.owedTotal': 'Total to collect: {amount}',
  'pot.buyerHint': 'If you paid for it, say so: you will then see who owes you what.',

  'pot.complete': 'The pot is full. The gift can be bought.',

  'pot.settledNote': 'The pot is closed: {name} bought the gift. Settle up with them directly.',
  'pot.settledNoteMine': 'The pot is closed. All that is left is getting paid back.',

  'error.nothingContributed': 'You have not put anything into this pot.',
  'error.alreadyBought': 'The gift has already been bought: settle your share directly.',

  'error.notTheBuyer': 'You did not declare this purchase.',
  'pot.iBought': 'I bought the gift',
  'pot.buyerHintNew': 'Press this once you have paid for it — not before. The pot then closes and you see who owes you what.',
  'pot.confirmShort': 'The pot is {amount} short. Confirming closes it and nobody will be able to chip in. Carry on?',
  'pot.confirmFull': 'The pot will close and nobody will be able to chip in. Carry on?',
  'pot.undo': 'Actually, I did not buy it',
  'pot.undoing': 'Undoing…',
  'pot.reopenNote': 'You can undo this: the pot reopens and the others can chip in again.',

  // ── Landing, for somebody who has never heard of this ────────────────────
  'landing.tagline': 'Gift lists, among friends',
  'landing.h1': 'Say what would make you happy. Your friends sort it out without you knowing.',
  'landing.intro':
    'Kado is an online gift list. You write down what you would like; your friends claim what they mean to give, club together for the big ones, and talk it over between themselves. You see none of it.',
  'landing.step1Title': 'You write down your wishes',
  'landing.step1Body': 'A shop link, a price, or just an idea. The name is enough.',
  'landing.step2Title': 'Your friends claim them',
  'landing.step2Body':
    'Everyone sees what is already taken, without knowing by whom. No more duplicates, no more awkward phone calls.',
  'landing.step3Title': 'You are surprised',
  'landing.step3Body':
    'On the day, you discover the gift. The app let you guess nothing.',
  'landing.secretTitle': 'The secret is not good manners, it is the structure',
  'landing.secretBody':
    'On a shared list, one tab open at the wrong moment ruins it. Here, reservations are never loaded when you are the one looking: there is nothing to let slip, even by accident.',
  'landing.demoOwner': 'What you see',
  'landing.demoFriend': 'What your friends see',
  'landing.demoGift': 'Cast iron teapot',
  'landing.demoNothing': 'No reservation information on this page.',
  'landing.demoTaken': 'Already claimed by a friend',
  'landing.demoPot': '45 € raised of 60 €',

  // ── Legal pages ──────────────────────────────────────────────────────────
  'legal.backHome': 'Back to the home page',
  'legal.updated': 'Last updated: 9 August 2026.',
  'legal.noticeTitle': 'Legal notice',
  'legal.publisher': 'Publisher',
  'legal.publisherBody':
    'Kado is published by a private individual, in a non-professional capacity, with no advertising and no revenue. Under article 6-III-2 of the French law on confidence in the digital economy, their identity is not published here: it is held by the host, who will disclose it at the request of a judicial authority.',
  'legal.director': 'Publication director',
  'legal.directorBody': 'The publisher, under the same terms of anonymity as above.',
  'legal.host': 'Host',
  'legal.hostDataBody':
    'Data is stored with Neon (database) and Vercel (uploaded files), on servers located in the European Union.',
  'legal.contact': 'Contact',

  'legal.privacyTitle': 'Privacy policy',
  'legal.privacyIntro':
    'This page describes what Kado records about you, why, for how long, and what you can demand. It describes how the app actually works, not a template.',
  'legal.controller': 'Data controller',
  'legal.controllerBody':
    'The publisher of Kado, reachable at sabri9595@gmail.com for any question or request about your data.',
  'legal.collected': 'What is recorded',
  'legal.collectedAccount':
    'Account: your email address, your name, and your password in hashed form — never in the clear, including to us.',
  'legal.collectedOptional':
    'Optional: a short description, your date of birth, a profile photo, your interests, a decorative GIF. None of it is required, and all of it can be changed or removed at any time.',
  'legal.collectedUse':
    'Use: your lists, your wishes, your friends, what you have claimed, what you have chipped in, and your messages in the private chats.',
  'legal.collectedTech':
    'Technical: a log of wishes added, gifts claimed and pots joined, used for gift suggestions; and sign-in attempts, kept for 24 hours to limit brute-force attacks.',
  'legal.why': 'Why, and on what basis',
  'legal.whyBody':
    'To perform the service you asked for by creating an account (GDPR article 6.1.b): without this data there is no list, no friend and no gift. Rate-limiting sign-in attempts rests on the legitimate interest in protecting accounts (article 6.1.f).',
  'legal.retention': 'For how long',
  'legal.retentionBody':
    'Your data is kept for as long as your account exists. A session expires after 30 days. Sign-in attempts are erased after 24 hours. When you delete your account, everything goes at once: lists, wishes, claims, contributions, messages, photos and activity log. Nothing is kept in anonymised form.',
  'legal.thirdParties': 'Who else sees anything',
  'legal.thirdPartiesBody':
    'Vercel hosts the app, stores the photos you upload and measures its audience and speed — see the next section. Neon hosts the database, in the European Union. When you search for a GIF the query goes to GIPHY, and GIFs shown on a profile are loaded from their servers — so GIPHY sees visits to that profile. When you paste a shop link the merchant refuses us, the page address is passed to an external reading service (r.jina.ai) to retrieve its title and price. No data is sold, rented, or passed on for advertising.',
  'legal.cookies': 'Cookies',
  'legal.cookiesBody':
    'One cookie is set: the one that keeps you signed in. It is strictly necessary to the service. No advertising cookie, no social-network cookie, no third-party tracker. That is why you are not asked to accept a banner.',
  'legal.measurement': 'Audience and performance measurement',
  'legal.measurementBody':
    'Two tools from Vercel, the host, are active. Speed Insights measures how quickly pages render: durations only, with no identifier and no following you from page to page. Web Analytics counts page views, countries and device types: it sets no cookie and keeps no IP address, but it derives a temporary identifier from one, renewed daily, to tell visits apart. These measurements exist to know whether the app is slow or used, never to profile you, and nothing is sold or shared for advertising. Any content blocker stops them without breaking the app.',
  'legal.rights': 'Your rights',
  'legal.rightsBody':
    'You may access your data, correct it, erase it, restrict its use or object to its processing. Most of that is in the app itself: your profile is editable, and deleting your account in Settings erases everything, with no delay and no email confirmation. For anything else, write to sabri9595@gmail.com. You may also complain to the CNIL.',
  'legal.secretNote': 'A note about the secret',
  'legal.secretNoteBody':
    'Kado is built so that a list’s owner cannot learn who claimed what. This is not a promise of discretion: reservations are never loaded when it is the owner looking at the page. What you chip in to a pot is shown by name only to the person who declares they bought the gift, and only at that point.',

  'legal.termsTitle': 'Terms of use',
  'legal.termsIntro':
    'By creating an account on Kado you accept the following. The service is free and provided as is.',
  'legal.termsAccess': 'Access to the service',
  'legal.termsAccessBody':
    'Kado is free, carries no advertising and commits you to nothing. You must be at least 15 to create an account. You are responsible for keeping your password to yourself.',
  'legal.termsContent': 'What you publish',
  'legal.termsContentBody':
    'You remain the owner of what you write and upload. You undertake not to publish anything unlawful, hateful or infringing on the rights of others, including in the private chats.',
  'legal.termsImages': 'Photos',
  'legal.termsImagesBody':
    'The photos you upload — profile picture, wish images — must be suitable for all audiences. Sexual, violent or shocking content is not allowed. These images are not scanned automatically: it is your responsibility, and that of the people who see them to report them to us.',
  'legal.termsReport': 'Reporting',
  'legal.termsReportBody':
    'A "Report" link sits under every profile and every wish you look at. Reporting is confidential: the person concerned is not told and cannot find out who reported them. Content clearly in breach is removed and the account may be suspended.',
  'legal.termsAvailability': 'Availability',
  'legal.termsAvailabilityBody':
    'The service is provided with no guarantee of availability. It may be interrupted, changed or discontinued, in particular for maintenance. Prices shown from shop links are indications taken from external pages: they may be wrong or out of date, and bind neither Kado nor the merchant.',
  'legal.termsEnd': 'Ending',
  'legal.termsEndBody':
    'You may delete your account at any time from Settings; erasure is immediate and final. These terms are governed by French law.',

  'legal.footerNotice': 'Legal notice',
  'legal.footerPrivacy': 'Privacy',
  'legal.footerTerms': 'Terms',

  'report.link': 'Report',
  'report.title': 'Report this content',
  'report.intro': 'Tell us what is wrong. The person concerned will not know.',
  'report.placeholder': 'Inappropriate photo, offensive wording…',
  'report.send': 'Send the report',
  'report.sending': 'Sending…',
  'report.thanks': 'Thank you. We will take a look.',
  'report.cancel': 'Cancel',
  'error.cannotReportYourself': 'You cannot report yourself.',

  // ── Invitations, uploads, search ─────────────────────────────────────────
  'invite.unused': 'Nobody has used it yet.',
  'invite.rotate': 'Generate a new link',
  'invite.rotating': 'One moment…',
  'upload.tooLarge': 'This image is larger than 4 MB.',
  'search.placeholder': 'Name or email address',
  'gif.placeholder': 'Search: cat, thanks, birthday…',
  'gif.choose': 'Choose this GIF',
  'gif.chooseNamed': 'Choose the GIF: {title}',
  'gif.unconfigured': 'GIF search is not configured on this server yet.',
  'gif.failed': 'The search did not respond. Try again in a moment.',
  'gif.resultCount': {
    one: '{count} GIF found',
    other: '{count} GIFs found',
  },
  'account.confirmDelete':
    'Permanently delete your account and all your data? This cannot be undone.',

  // ── Invitations ──────────────────────────────────────────────────────────
  'invite.unknownTitle': 'This invitation does not exist',
  'invite.closedTitle': 'This invitation has been closed',
  'invite.goHome': 'Go to the home page',
  'invite.seeFriends': 'See my friends',
};
