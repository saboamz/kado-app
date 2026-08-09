import type { Plural } from './t';

/**
 * The French phrasebook — and the shape every other language must match.
 *
 * French is the source because the app was written in it: these are the exact
 * strings that were in the components, so translating changed no copy, only
 * where it lives. `Dictionary` is derived from this object, so a key missing
 * from en.ts is a compile error rather than a blank on a page.
 *
 * Keys are `area.thing`, flat. Sorted by area so a translator reads a screen
 * at a time rather than hunting alphabetically.
 */
export const fr = {
  // ── Navigation and chrome ────────────────────────────────────────────────
  'nav.main': 'Navigation principale',
  'nav.home': 'Accueil',
  'nav.lists': 'Mes listes',
  'nav.search': 'Rechercher',
  'nav.alerts': 'Alertes',
  'nav.profile': 'Profil',
  'nav.unread': { one: '{count} notification non lue', other: '{count} notifications non lues' },

  // ── Shared words ─────────────────────────────────────────────────────────
  'common.seeAll': 'Tout voir',
  'common.default': 'Par défaut',
  'common.cancel': 'Annuler',
  'common.save': 'Enregistrer',
  'common.delete': 'Supprimer',
  'common.back': 'Retour',
  'common.wishes': { one: '{count} envie', other: '{count} envies' },
  'common.lists': { one: '{count} liste', other: '{count} listes' },
  'common.friends': { one: '{count} ami', other: '{count} amis' },
  'common.reserved': { one: '{count} déjà réservée', other: '{count} déjà réservées' },
  'common.results': { one: '{count} résultat', other: '{count} résultats' },

  // ── Landing ──────────────────────────────────────────────────────────────
  'landing.title': 'Des listes de souhaits que vos proches remplissent en secret.',
  'landing.lede':
    'Ajoutez ce qui vous ferait plaisir. Vos amis réservent, se regroupent pour les gros cadeaux, et vous ne voyez jamais qui a pris quoi. La surprise est garantie par l’application, pas par leur discrétion.',
  'landing.createAccount': 'Créer mon compte',
  'landing.signIn': 'J’ai déjà un compte',
  'landing.point1': 'Le secret est structurel.',
  'landing.point2': 'À plusieurs pour les gros cadeaux.',
  'landing.point3': 'Rien ne se perd.',

  // ── Sign in / sign up ────────────────────────────────────────────────────
  'auth.welcomeBack': 'Content de vous revoir.',
  'auth.createYours': 'Créez votre compte.',
  'auth.name': 'Nom',
  'auth.email': 'Adresse e-mail',
  'auth.password': 'Mot de passe',
  'auth.passwordHint': 'Au moins 8 caractères.',
  'auth.signIn': 'Se connecter',
  'auth.signUp': 'Créer mon compte',
  'auth.createAccount': 'Créer un compte',

  // ── Home ─────────────────────────────────────────────────────────────────
  'home.greeting': 'Bonjour {name}',
  'home.subtitle': 'Vos listes, et ce que préparent vos proches.',
  'home.birthdays': 'Anniversaires',
  'home.myLists': 'Mes listes',
  'home.aroundYou': 'Chez vos proches',
  'home.noListsTitle': 'Aucune liste pour l’instant',
  'home.noListsBody':
    'Créez une liste et ajoutez ce qui vous ferait plaisir. Vos proches sauront quoi offrir.',
  'home.createList': 'Créer une liste',
  'home.noFriendsTitle': 'Pas encore d’amis',
  'home.noFriendsBody':
    'Invitez vos proches pour voir leurs listes et savoir quoi leur offrir.',
  'home.inviteFriends': 'Inviter mes proches',

  // ── Getting started ──────────────────────────────────────────────────────
  'onboarding.title': 'Pour bien commencer',
  'onboarding.progress': '{done} sur {total} — quelques minutes, pas plus.',
  'onboarding.dismiss': 'Masquer',
  'onboarding.done': 'terminé',
  'onboarding.wishTitle': 'Ajoutez une première envie',
  'onboarding.wishBody':
    'Un lien, un prix, une idée — c’est ce que vos proches viendront regarder.',
  'onboarding.wishCta': 'Ajouter une envie',
  'onboarding.friendTitle': 'Invitez quelqu’un',
  'onboarding.friendBody':
    'Votre lien d’invitation vous connecte directement, sans recherche.',
  'onboarding.friendCta': 'Obtenir mon lien',
  'onboarding.profileTitle': 'Complétez votre profil',
  'onboarding.profileBody':
    'Date de naissance et centres d’intérêt : de quoi guider ceux qui cherchent une idée.',
  'onboarding.profileCta': 'Compléter',
  'onboarding.decorationTitle': 'Décorez votre profil',
  'onboarding.decorationBody':
    'Un GIF en bas de page, pour que votre profil vous ressemble.',
  'onboarding.decorationCta': 'Choisir un GIF',

  // ── Lists ────────────────────────────────────────────────────────────────
  'lists.title': 'Mes listes',
  'lists.subtitle': 'Ce que vous aimeriez recevoir, rangé par occasion.',
  'lists.emptyBody': 'Créez une liste — anniversaire, Noël, ou simplement vos envies du moment.',
  'lists.newList': 'Nouvelle liste',
  'lists.emptyListTitle': 'Cette liste est vide',
  'lists.emptyListBody': 'Ajoutez ce qui vous ferait plaisir.',
  'lists.addWish': 'Ajouter une envie',
  'lists.theirLists': 'Ses listes',
  'lists.noVisibleLists': 'Aucune liste visible',

  // ── A wish ───────────────────────────────────────────────────────────────
  'gift.pot': 'Cagnotte',
  'gift.reservedByYou': 'Réservé par vous',
  'gift.alreadyReserved': 'Déjà réservé',
  'gift.youReservedIt': 'Vous l’avez réservé',
  'gift.sharedGift': 'Cadeau à plusieurs',
  'gift.friendsSide': 'Côté amis',
  'gift.hiddenIfYouReserve':
    'Si vous le réservez, cela restera invisible pour le propriétaire de la liste.',
  'gift.ownerSeesNothing': 'Le propriétaire de la liste ne voit rien de tout ceci.',

  // ── Friends and search ───────────────────────────────────────────────────
  'friends.title': 'Mes amis',
  'friends.subtitle': 'Les personnes dont vous voyez les listes, et qui voient les vôtres.',
  'friends.emptyBody': 'Ajoutez vos proches pour voir leurs listes et savoir quoi leur offrir.',
  'friends.find': 'Chercher des amis',
  'search.title': 'Rechercher',
  'search.subtitle': 'Trouvez vos proches pour voir leurs listes.',
  'search.nobodyTitle': 'Personne trouvée',
  'search.nobodyBody': 'Essayez un autre nom, ou l’adresse e-mail exacte de la personne.',
  'search.suggestions': 'Suggestions',
  'search.noSuggestionsTitle': 'Personne à suggérer',
  'search.noSuggestionsBody': 'Cherchez vos proches par nom ou par adresse e-mail.',

  // ── Notifications ────────────────────────────────────────────────────────
  'notifications.title': 'Notifications',
  'notifications.emptyTitle': 'Rien de neuf',
  'notifications.emptyBody':
    'Les anniversaires, nouvelles listes et demandes d’amis apparaîtront ici.',
  'notifications.unread': 'Non lue',

  // ── Birthdays ────────────────────────────────────────────────────────────
  'birthdays.title': 'Anniversaires',
  'birthdays.subtitle': 'Qui fête quoi, et quand — pour ne plus jamais s’y prendre trop tard.',
  'birthdays.emptyTitle': 'Aucun anniversaire connu',
  'birthdays.emptyBody':
    'Vos amis n’ont pas renseigné leur date de naissance, ou vous n’avez pas encore d’amis.',
  'birthdays.findPeople': 'Trouver des proches',
  'birthdays.thisMonth': 'Dans le mois',
  'birthdays.later': 'Plus tard',

  // ── Profile and settings ─────────────────────────────────────────────────
  'profile.title': 'Profil',
  'profile.lists': 'Listes',
  'profile.wishes': 'Envies',
  'profile.friends': 'Amis',
  'profile.interests': 'Centres d’intérêt',
  'profile.editTitle': 'Modifier mon profil',
  'profile.editSubtitle': 'Ce que vos proches voient de vous.',
  'profile.decorate': 'Décorer mon profil',
  'settings.title': 'Paramètres',
  'settings.language': 'Langue',
  'settings.languageHint': 'La langue dans laquelle vous lisez Kado.',
  'settings.deleteAccount': 'Supprimer mon compte',

  // ── Forms ────────────────────────────────────────────────────────────────
  'form.giftName': "Qu'est-ce qui vous ferait plaisir ?",
  'form.giftNamePlaceholder': 'AirPods Pro, un vase en grès, un week-end…',
  'form.link': 'Lien',
  'form.linkPlaceholder': 'Facultatif — collez le lien de la boutique',
  'form.linkHint':
    'La boutique, la photo et le prix seront repris de la page si nous arrivons à la lire.',
  'form.price': 'Prix',
  'form.optional': 'Facultatif',
  'form.category': 'Catégorie',
  'form.choose': 'Choisir…',
  'form.photo': 'Photo',
  'form.details': 'Précisions',
  'form.detailsPlaceholder': 'Taille, couleur, modèle exact…',
  'form.listName': 'Nom de la liste',
  'form.listNamePlaceholder': 'Anniversaire, Noël, Mariage…',
  'form.occasion': 'Occasion',
  'form.avatar': 'Photo de profil',
  'form.about': 'À propos',
  'form.aboutPlaceholder': 'Ce que vous aimez, en une phrase.',
  'form.birthday': 'Date de naissance',
  'form.birthdayHint': 'Vos amis verront le jour, jamais l’année.',
  'form.interests': "Centres d'intérêt",
  'form.interestsPlaceholder': 'Café, céramique, randonnée',
  'form.interestsHint': 'Séparés par des virgules — de quoi inspirer vos proches.',
  'form.appearance': 'Apparence',
  'form.privacy': 'Confidentialité',
  'form.publicProfile': 'Profil public',
  'visibility.friends': 'Mes amis',
  'visibility.friendsHint': 'Seuls vos amis voient cette liste.',
  'visibility.private': 'Personne',
  'visibility.public': 'Tout le monde',
  'visibility.privateHint': 'Visible par vous seul, pour préparer tranquillement.',
  'visibility.publicHint': 'Accessible à quiconque a le lien.',

  // ── Actions and states ───────────────────────────────────────────────────
  'action.add': 'Ajouter',
  'action.edit': 'Modifier',
  'action.creating': 'Création…',
  'action.saving': 'Enregistrement…',
  'action.signingIn': 'Connexion…',
  'action.copied': 'Copié',
  'action.searching': 'Recherche…',
  'action.nothingYet': 'Rien pour l’instant',

  // ── Reserving and pots ───────────────────────────────────────────────────
  'reserve.cta': 'Je réserve ce cadeau',
  'reserve.pending': 'Réservation…',
  'reserve.openToOthers': 'Inviter d’autres à participer',
  'reserve.youOpened':
    'Vous avez ouvert ce cadeau aux autres invités. Participez à la cagnotte ci-dessous.',
  'reserve.someoneOpened':
    'Un proche a ouvert ce cadeau à plusieurs. Vous pouvez participer à la cagnotte ci-dessous.',
  'pot.nobodyYet': 'Personne n’a encore participé.',
  'pot.quickAmounts': 'Montants rapides',
  'pot.amount': 'Montant',
  'chat.title': 'Discussion secrète',
  'chat.placeholder': 'Je peux mettre 50 €…',

  // ── Lists and wishes, continued ──────────────────────────────────────────
  'lists.emptyListHint': 'Ajoutez une envie : un lien, un prix, ou simplement une idée.',
  'lists.newTitle': 'Nouvelle liste',
  'lists.newSubtitle': 'Une liste par occasion : anniversaire, Noël, ou vos envies du moment.',
  'lists.create': 'Créer la liste',
  'lists.editTitle': 'Modifier la liste',
  'lists.deleteList': 'Supprimer cette liste',
  'gift.addTitle': 'Ajouter une envie',
  'gift.addCta': 'Ajouter à ma liste',
  'gift.adding': 'Ajout…',
  'gift.editTitle': 'Modifier cette envie',
  'gift.deleteGift': 'Supprimer cette envie',

  'friend.add': 'Ajouter',
  'friend.accept': 'Accepter',
  'friend.decline': 'Refuser',
  'friend.remove': 'Retirer',
  'friend.requestSent': 'Demande envoyée',
  'form.whoCanSee': 'Qui peut voir cette liste ?',
  'form.howMuch': 'À quel point en avez-vous envie ?',
  'priority.1': 'Une idée, sans plus',
  'priority.2': 'J’aimerais bien',
  'priority.3': 'Ça me ferait très plaisir',

  // ── Errors ───────────────────────────────────────────────────────────────
  // Keys, not sentences, come out of the validation schemas: those are built
  // once at import, before any request, so a message baked in there could
  // only ever be one language. They are translated where the action answers.
  'error.emailRequired': 'Renseignez votre adresse e-mail.',
  'error.emailInvalid': 'Cette adresse e-mail semble invalide.',
  'error.passwordShort': 'Le mot de passe doit contenir au moins 8 caractères.',
  'error.passwordLong': 'Le mot de passe est trop long.',
  'error.passwordRequired': 'Renseignez votre mot de passe.',
  'error.nameRequired': 'Renseignez votre nom.',
  'error.nameLong': 'Ce nom est trop long.',
  'error.textLong': 'Ce texte est trop long.',
  'error.giftNameRequired': 'Donnez un nom à cette envie.',
  'error.listNameRequired': 'Donnez un nom à votre liste.',
  'error.categoryRequired': 'Choisissez une catégorie.',
  'error.giftNotFound': 'Cadeau introuvable',
  'error.messageNotFound': 'Message introuvable.',
  'error.personNotFound': 'Cette personne est introuvable.',
  'error.requestGone': 'Cette demande n’existe plus.',
  'error.relationGone': 'Cette relation n’existe plus.',
  'error.alreadyFriends': 'Vous êtes déjà amis.',
  'error.requestAlreadySent': 'Demande déjà envoyée.',
  'error.cannotAddYourself': 'Vous ne pouvez pas vous ajouter vous-même.',
  'error.ownInviteLink': 'C’est votre propre lien d’invitation.',
  'error.inviteClosed': 'Cette invitation a été fermée.',
  'error.inviteUnknown': 'Cette invitation n’existe pas.',
  'error.cannotReserveOwn': 'Vous ne pouvez pas réserver un cadeau de votre liste.',
  'error.cannotContributeOwn': 'Vous ne pouvez pas participer à une cagnotte de votre liste.',
  'error.potComplete': 'La cagnotte est déjà complète. Merci !',
  'error.amountInvalid': 'Ce montant semble invalide.',
  'error.amountTooHigh': 'Ce montant est trop élevé.',
  'error.amountMinimum': 'Le minimum est de 1 €.',
  'error.unknownSlot': 'Emplacement inconnu.',
  'error.imageUnreadable': 'Cette image est illisible.',
  'error.imageNotAllowed': 'Cette image ne vient pas d’une source autorisée.',
  'error.tryLater': 'Impossible pour le moment.',

  'time.justNow': 'à l’instant',
  'time.today': 'c’est aujourd’hui',
  'time.tomorrow': 'demain',
  'time.inDays': 'dans {count} jours',
  'time.inOneMonth': 'dans un mois',
  'time.inMonths': 'dans {count} mois',

  'meta.invitation': 'Invitation',

  'pot.heading': 'Cagnotte',
  'pot.raisedOf': 'réunis sur {target}',
  'pot.participants': { one: '{count} personne participe', other: '{count} personnes participent' },
  'pot.remaining': 'il reste {amount}',
  'pot.yourShare': 'Votre part :',
  'pot.progress': 'Cagnotte à {percent} %',
  'image.change': 'Changer',
  'image.choose': 'Choisir une image',
  'gif.close': 'Fermer',
  'gif.change': 'Changer',
  'gif.remove': 'Retirer',

  'settings.themeSystem': 'Comme mon appareil',
  'settings.themeLight': 'Clair',
  'settings.themeDark': 'Sombre',
  'settings.currency': 'Devise',
  'settings.publicProfileHint':
    'Toute personne ayant le lien peut voir votre profil et vos listes publiques. Vos réservations restent privées quoi qu’il arrive.',
  'settings.saved': 'Vos préférences ont été enregistrées.',

  'error.emailTaken': 'Un compte existe déjà avec cette adresse.',
  'error.badCredentials': 'E-mail ou mot de passe incorrect.',
  'error.tooManyAttempts': 'Trop de tentatives. Réessayez dans quelques minutes.',
  'lists.defaultName': 'Mes envies',

  'error.retryMinutes': {
    one: 'Trop de tentatives. Réessayez dans une minute.',
    other: 'Trop de tentatives. Réessayez dans {count} minutes.',
  },

  'chat.empty': 'Aucun message. Lancez la conversation.',
  'chat.yourMessage': 'Votre message',
  'chat.send': 'Envoyer',
  'chat.sending': 'Envoi…',
  'delete.list': 'Supprimer la liste',
  'delete.listConfirm': 'Supprimer la liste « {name} » et toutes ses envies ? Cette action est définitive.',
  'delete.gift': 'Supprimer cette envie',
  'delete.giftConfirm': 'Supprimer « {name} » de votre liste ?',
  'reserve.cancel': 'Annuler ma réservation',
  'profile.friendsCount': 'Mes amis ({count})',
  'profile.noListsToShare': 'Cette personne n’a pas encore de liste à partager.',
  'settings.deleteWarning':
    'Vos listes, vos envies et vos messages seront définitivement supprimés.',
  'auth.signupLede': 'Vos listes, vos amis, et des surprises qui le restent vraiment.',

  'pot.contribute': 'Participer',

  // ── Invitations, uploads, search ─────────────────────────────────────────
  'invite.unused': 'Personne ne l’a encore utilisé.',
  'invite.rotate': 'Générer un nouveau lien',
  'upload.tooLarge': 'Cette image dépasse 4 Mo.',
  'search.placeholder': 'Nom ou adresse e-mail',
  'gif.placeholder': 'Chercher : chat, merci, anniversaire…',
  'account.confirmDelete':
    'Supprimer définitivement votre compte et toutes vos données ? Cette action est irréversible.',

  // ── Invitations ──────────────────────────────────────────────────────────
  'invite.unknownTitle': 'Cette invitation n’existe pas',
  'invite.closedTitle': 'Cette invitation a été fermée',
  'invite.goHome': 'Aller à l’accueil',
  'invite.seeFriends': 'Voir mes amis',
} satisfies Record<string, string | Plural>;
