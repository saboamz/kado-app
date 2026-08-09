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
  'landing.title': 'Wishlists your friends fill in secret.',
  'landing.lede':
    'Add what you would love to receive. Your friends claim gifts, club together for the big ones, and you never see who took what. The surprise is guaranteed by the app, not by how good they are at keeping quiet.',
  'landing.createAccount': 'Create my account',
  'landing.signIn': 'I already have an account',
  'landing.point1': 'The secret is structural.',
  'landing.point2': 'Club together for the big gifts.',
  'landing.point3': 'Nothing gets lost.',

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
  'home.birthdays': 'Birthdays',
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
    'Birthday and interests: enough to guide anyone looking for an idea.',
  'onboarding.profileCta': 'Complete',
  'onboarding.decorationTitle': 'Decorate your profile',
  'onboarding.decorationBody': 'A GIF at the foot of the page, so your profile looks like you.',
  'onboarding.decorationCta': 'Choose a GIF',

  // ── Lists ────────────────────────────────────────────────────────────────
  'lists.title': 'My lists',
  'lists.subtitle': 'What you would like to receive, sorted by occasion.',
  'lists.emptyBody':
    'Create a list — a birthday, Christmas, or simply what you feel like right now.',
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
  'notifications.emptyTitle': 'Nothing new',
  'notifications.emptyBody': 'Birthdays, new lists and friend requests will show up here.',
  'notifications.unread': 'Unread',

  // ── Birthdays ────────────────────────────────────────────────────────────
  'birthdays.title': 'Birthdays',
  'birthdays.subtitle': 'Who is celebrating what, and when — so you are never caught out again.',
  'birthdays.emptyTitle': 'No birthdays known',
  'birthdays.emptyBody':
    'Your friends have not given their date of birth, or you have no friends yet.',
  'birthdays.findPeople': 'Find people',
  'birthdays.thisMonth': 'Within the month',
  'birthdays.later': 'Later',

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
  'form.listNamePlaceholder': 'Birthday, Christmas, Wedding…',
  'form.occasion': 'Occasion',
  'form.avatar': 'Profile photo',
  'form.about': 'About',
  'form.aboutPlaceholder': 'What you like, in one sentence.',
  'form.birthday': 'Date of birth',
  'form.birthdayHint': 'Your friends will see the day, never the year.',
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
  'lists.newSubtitle': 'One list per occasion: a birthday, Christmas, or what you fancy now.',
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

  'settings.themeSystem': 'Match my device',
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

  // ── Invitations, uploads, search ─────────────────────────────────────────
  'invite.unused': 'Nobody has used it yet.',
  'invite.rotate': 'Generate a new link',
  'upload.tooLarge': 'This image is larger than 4 MB.',
  'search.placeholder': 'Name or email address',
  'gif.placeholder': 'Search: cat, thanks, birthday…',
  'account.confirmDelete':
    'Permanently delete your account and all your data? This cannot be undone.',

  // ── Invitations ──────────────────────────────────────────────────────────
  'invite.unknownTitle': 'This invitation does not exist',
  'invite.closedTitle': 'This invitation has been closed',
  'invite.goHome': 'Go to the home page',
  'invite.seeFriends': 'See my friends',
};
