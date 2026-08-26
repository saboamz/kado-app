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
  'nav.skip': 'Aller au contenu',
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
  'landing.createAccount': 'Créer mon compte',

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
  'auth.forgotPassword': 'Mot de passe oublié ?',
  'auth.forgotTitle': 'Mot de passe oublié.',
  'auth.forgotLede':
    'Indiquez votre adresse : si un compte existe, un lien pour en choisir un nouveau arrivera par e-mail.',
  'auth.forgotSend': 'Envoyer le lien',
  'auth.forgotSending': 'Envoi…',
  'auth.forgotSent':
    'Si un compte existe avec cette adresse, un e-mail vient de partir. Pensez à vérifier vos indésirables.',
  'auth.resetTitle': 'Choisissez un nouveau mot de passe.',
  'auth.resetLede': 'Il remplacera l’ancien sur tous vos appareils.',
  'auth.resetAgain': 'Demander un nouveau lien',
  'auth.backToLogin': 'Retour à la connexion',

  // ── L'e-mail de réinitialisation ─────────────────────────────────────────
  'email.resetSubject': 'Réinitialisation de votre mot de passe Kadlio',
  'email.resetGreeting': 'Bonjour {name},',
  'email.resetBody':
    'Quelqu’un — vous, normalement — a demandé à réinitialiser le mot de passe de votre compte Kadlio. Ce lien est valable une heure et ne sert qu’une fois.',
  'email.resetButton': 'Choisir un nouveau mot de passe',
  'email.resetLinkFallback': 'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :',
  'email.resetIgnore':
    'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.',

  // ── Home ─────────────────────────────────────────────────────────────────
  'home.greeting': 'Bonjour {name}',
  'home.subtitle': 'Vos listes, et ce que préparent vos proches.',
  'home.events': 'À venir',
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
    'Vos centres d’intérêt : de quoi guider ceux qui cherchent une idée.',
  'onboarding.profileCta': 'Compléter',
  'onboarding.decorationTitle': 'Décorez votre profil',
  'onboarding.decorationBody':
    'Un GIF en bas de page, pour que votre profil vous ressemble.',
  'onboarding.decorationCta': 'Choisir un GIF',

  // ── Lists ────────────────────────────────────────────────────────────────
  'lists.title': 'Mes listes',
  'lists.subtitle': 'Ce que vous aimeriez recevoir, rangé par occasion.',
  'lists.emptyBody': 'Créez une liste pour vos envies du moment.',
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
  'notifications.markAll': 'Tout marquer comme lu',
  'notifications.markingAll': 'Marquage…',
  'notifications.markAllFailed': 'Le marquage n’a pas abouti. Réessayez.',
  'notifications.emptyTitle': 'Rien de neuf',
  'notifications.emptyBody':
    'Les dates à venir, nouvelles listes et demandes d’amis apparaîtront ici.',
  'notifications.unread': 'Non lue',

  // ── Events ───────────────────────────────────────────────────────────────
  'events.title': 'À venir',
  'events.subtitle': 'Les dates que vos proches ont choisi de publier.',
  'events.emptyTitle': 'Aucune date à venir',
  'events.emptyBody':
    'Vos proches n’ont publié aucune date, ou vous n’avez pas encore d’amis.',
  'events.findPeople': 'Trouver des proches',
  'events.thisMonth': 'Dans le mois',
  'events.later': 'Plus tard',
  'events.mine': 'Mes dates',
  'events.add': 'Ajouter une date',
  'events.label': 'Intitulé',
  'events.labelPlaceholder': 'Mariage, remise de diplôme, crémaillère…',
  'events.labelHint': 'C’est vous qui choisissez ce que vous publiez, et son nom.',
  'events.day': 'Jour',
  'events.month': 'Mois',
  'events.visibility': 'Qui peut la voir',
  'events.none': 'Vous n’avez publié aucune date.',
  'events.delete': 'Retirer',
  'events.adding': 'Ajout…',

  // ── Sign-up questionnaire ────────────────────────────────────────────────
  'survey.title': 'Deux questions, et c’est tout',
  'survey.subtitle':
    'Elles servent à vous proposer des idées de cadeaux. Rien n’est obligatoire, et vous pourrez tout modifier dans votre profil.',
  'survey.interestsTitle': 'Qu’est-ce qui vous plaît ?',
  'survey.interestsHint': 'Cochez ce que vous voulez, autant que vous voulez.',
  'survey.aboutTitle': 'À propos de vous',
  'survey.aboutHint':
    'Facultatif. Ces réponses affinent les suggestions et ne sont montrées à personne — ni sur votre profil, ni à vos proches.',
  'survey.gender': 'Vous êtes…',
  'survey.genderFemale': 'Une femme',
  'survey.genderMale': 'Un homme',
  'survey.genderOther': 'Autre',
  'survey.age': 'Votre tranche d’âge',
  'survey.noAnswer': 'Je préfère ne pas répondre',
  'survey.submit': 'Enregistrer et continuer',
  'survey.saving': 'Enregistrement…',
  'survey.skip': 'Passer cette étape',
  'survey.privacy':
    'Vous pouvez modifier ou effacer ces réponses à tout moment, et supprimer votre compte efface tout.',

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
  'settings.languageHint': 'La langue dans laquelle vous lisez Kadlio.',
  'settings.deleteAccount': 'Supprimer mon compte',
  'settings.password': 'Mot de passe',
  'password.current': 'Mot de passe actuel',
  'password.next': 'Nouveau mot de passe',
  'password.save': 'Changer le mot de passe',
  'password.saving': 'Enregistrement…',
  'password.done':
    'Mot de passe changé. Vos autres sessions ont été déconnectées.',

  // ── Forms ────────────────────────────────────────────────────────────────
  'form.giftName': "Qu'est-ce qui vous ferait plaisir ?",
  'form.giftNamePlaceholder': 'AirPods Pro, un vase en grès, un week-end…',
  'form.link': 'Lien',
  'form.linkPlaceholder': 'Facultatif — collez le lien de la boutique',
  'form.linkHint':
    'Collez le lien d’une boutique : le nom, le prix et la photo se remplissent tout seuls quand la page se laisse lire.',
  'form.linkReading': 'Lecture de la page…',
  'form.linkFilled': 'Rempli depuis la page — vérifiez avant d’enregistrer.',
  'form.linkNothing':
    'Cette page ne se laisse pas lire — remplissez le nom vous-même.',
  'form.price': 'Prix',
  'form.optional': 'Facultatif',
  'form.category': 'Catégorie',
  'form.choose': 'Choisir…',
  'form.photo': 'Photo',
  'form.photoFound': 'Photo trouvée sur la page — elle sera utilisée si vous n’en choisissez pas une autre.',
  'form.photoFoundIgnore': 'Ne pas l’utiliser',
  'form.details': 'Précisions',
  'form.detailsPlaceholder': 'Taille, couleur, modèle exact…',
  'form.listName': 'Nom de la liste',
  'form.listNamePlaceholder': 'Mariage, Crémaillère…',
  'form.occasion': 'Occasion',
  'form.avatar': 'Photo de profil',
  'form.about': 'À propos',
  'form.aboutPlaceholder': 'Ce que vous aimez, en une phrase.',
  'form.interests': "Centres d'intérêt",
  'form.interestsHint': 'Cochez ce qui vous ressemble — de quoi inspirer vos proches.',
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
  'action.loading': 'Chargement…',
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
  'lists.quickAddPlaceholder': 'Collez un lien, ou écrivez une envie…',
  // The box's own button. Named against the header's « Ajouter » : the two
  // ways in tell themselves apart by their buttons, without a caption.
  'lists.quickAddCta': 'Ajout rapide',
  'lists.newTitle': 'Nouvelle liste',
  'lists.newSubtitle': 'Une liste par occasion, ou pour vos envies du moment.',
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
  'error.passwordUnchanged': 'Choisissez un mot de passe différent de l’actuel.',
  'error.resetInvalid': 'Ce lien ne fonctionne plus. Demandez-en un nouveau.',
  'error.nameRequired': 'Renseignez votre nom.',
  'error.nameLong': 'Ce nom est trop long.',
  'error.textLong': 'Ce texte est trop long.',
  'error.giftNameRequired': 'Donnez un nom à cette envie.',
  'error.listNameRequired': 'Donnez un nom à votre liste.',
  'error.eventLabelRequired': 'Donnez un nom à cette date.',
  'error.eventDateInvalid': 'Cette date n’existe pas.',
  'error.eventTooMany': 'Vous avez atteint le nombre maximum de dates.',
  'error.eventNotFound': 'Date introuvable.',
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

  'settings.themeLight': 'Clair',
  'settings.themeDark': 'Sombre',
  'settings.currency': 'Devise',
  'settings.publicProfileHint':
    'Toute personne ayant le lien peut voir votre profil et vos listes publiques. Vos réservations restent privées quoi qu’il arrive.',
  'settings.saved': 'Vos préférences ont été enregistrées.',

  'error.emailTaken': 'Un compte existe déjà avec cette adresse.',
  'error.badCredentials': 'E-mail ou mot de passe incorrect.',
  'error.tooManyAttempts': 'Trop de tentatives. Réessayez dans quelques minutes.',
  'error.tooManyUploads': 'Trop d’images envoyées d’affilée. Réessayez plus tard.',
  'error.tooManyRequests': 'Trop de demandes d’affilée. Réessayez plus tard.',
  'error.tooManyReports': 'Trop de signalements d’affilée. Réessayez demain.',
  'error.tooManyMessages': 'Trop de messages d’affilée. Réessayez dans un instant.',
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
  'pot.contributing': 'Envoi…',
  'pot.withdraw': 'Retirer ma participation',
  'pot.withdrawing': 'Retrait…',

  'gift.estimatedPrice': '~{price}',
  'gift.estimatedNote': 'Prix relevé sur la boutique, à titre indicatif — {name} ne l’a pas renseigné.',

  'gift.potHiddenFromOwner': '{name} ne voit ni le total, ni les participants, ni même l’existence de cette cagnotte.',

  'gift.estimatedNoteOwn': 'Prix relevé sur la boutique, à titre indicatif — vous ne l’avez pas renseigné.',

  'gift.linkUnread': 'Nous n’avons pas pu lire cette page — certaines boutiques refusent les robots. Ajoutez le prix vous-même si vous le souhaitez.',

  'pot.goalLabel': 'Objectif de la cagnotte',
  'pot.goalFromShop': 'Relevé sur la boutique. Corrigez si le prix a changé.',
  'pot.goalFree': 'Facultatif — sans objectif, la cagnotte collecte sans jamais se dire complète.',
  'reserve.opening': 'Ouverture…',
  'reserve.takeBack': 'Le reprendre pour moi seul',
  'reserve.mineNote': 'Vous avez réservé ce cadeau. Si le prix est élevé, ouvrez-le aux autres invités : chacun mettra ce qu’il veut, et le propriétaire n’en saura toujours rien.',
  'reserve.freeNote': 'Les autres invités verront qu’il est pris, sans savoir par qui. Le propriétaire ne verra rien du tout.',

  'error.notOpenToOthers': 'Ce cadeau n’est pas ouvert à plusieurs.',
  'error.noAccessToList': 'Vous n’avez pas accès à cette liste.',
  'error.alreadyPurchased': 'Quelqu’un s’en est déjà occupé.',
  'error.contributeFirst': 'Participez d’abord à la cagnotte pour pouvoir l’acheter.',
  'pot.iBoughtIt': 'C’est moi qui l’achète',
  'pot.declaring': 'Enregistrement…',
  'pot.boughtByMe': 'Vous l’avez acheté. Voici ce que les autres vous doivent.',
  'pot.boughtBy': '{name} l’a acheté.',
  'pot.youOwe': 'Vous lui devez {amount}.',
  'pot.nobodyOwes': 'Personne ne vous doit rien pour l’instant.',
  'pot.owedTotal': 'Total à récupérer : {amount}',
  'pot.buyerHint': 'Si vous avez avancé l’argent, dites-le : vous verrez alors qui vous doit quoi.',

  'pot.complete': 'La cagnotte est complète. Le cadeau peut être acheté.',

  'pot.settledNote': 'La cagnotte est close : {name} a acheté le cadeau. Réglez-lui votre part directement.',
  'pot.settledNoteMine': 'La cagnotte est close. Il ne reste qu’à vous faire rembourser.',

  'error.nothingContributed': 'Vous n’avez rien versé dans cette cagnotte.',
  'error.alreadyBought': 'Le cadeau a déjà été acheté : réglez votre part directement.',

  'error.notTheBuyer': 'Vous n’avez pas déclaré cet achat.',
  'pot.iBought': 'J’ai acheté le cadeau',
  'pot.buyerHintNew': 'À cliquer une fois le cadeau payé — pas avant. La cagnotte se ferme alors et vous voyez qui vous doit quoi.',
  'pot.confirmShort': 'Il manque {amount} à la cagnotte. En validant, elle se ferme et personne ne pourra plus participer. Continuer ?',
  'pot.confirmFull': 'La cagnotte se ferme et personne ne pourra plus participer. Continuer ?',
  'pot.undo': 'Finalement, je ne l’ai pas acheté',
  'pot.undoing': 'Annulation…',
  'pot.reopenNote': 'Vous pouvez revenir en arrière : la cagnotte se rouvrira et les autres pourront à nouveau participer.',

  // ── Landing, for somebody who has never heard of this ────────────────────
  'landing.tagline': 'Listes de cadeaux, entre proches',
  'landing.h1': 'Dites ce qui vous ferait plaisir. Vos proches s’organisent sans que vous le sachiez.',
  'landing.intro':
    'Kadlio est une liste de cadeaux en ligne. Vous y notez vos envies ; vos proches y réservent ce qu’ils comptent offrir, se regroupent pour les gros cadeaux, et discutent entre eux. Vous, vous ne voyez rien de tout ça.',
  'landing.step1Title': 'Vous notez vos envies',
  'landing.step1Body': 'Un lien de boutique, un prix, ou juste une idée. Le nom suffit.',
  'landing.step2Title': 'Vos proches réservent',
  'landing.step2Body':
    'Chacun voit ce qui est déjà pris, sans savoir par qui. Plus de doublons, plus de coups de fil gênés.',
  'landing.step3Title': 'Vous êtes surpris',
  'landing.step3Body':
    'Le jour venu, vous découvrez le cadeau. L’application ne vous a rien laissé deviner.',
  'landing.secretTitle': 'Le secret n’est pas une politesse, c’est la structure',
  'landing.secretBody':
    'Sur une liste partagée, il suffit d’un onglet ouvert au mauvais moment pour tout gâcher. Ici, les réservations ne sont jamais chargées quand c’est vous qui regardez : il n’y a rien à laisser filer, même par accident.',
  'landing.demoOwner': 'Ce que vous voyez, vous',
  'landing.demoFriend': 'Ce que voient vos proches',
  'landing.demoGift': 'Théière en fonte',
  'landing.demoNothing': 'Aucune information de réservation sur cette page.',
  'landing.demoTaken': 'Déjà réservé par un proche',
  'landing.demoPot': '45 € réunis sur 60 €',
  'landing.occasionsTitle': 'Kadlio pour chaque occasion',

  // ── Intent pages, one per thing somebody searches for ────────────────────
  //
  // Written like the landing: sober, factual, and only about what the app
  // actually does. A page that promises a feature we do not have ranks for a
  // week and disappoints forever.
  'seo.faqTitle': 'Questions fréquentes',
  'seo.othersTitle': 'Kadlio pour d’autres occasions',
  'seo.ctaTitle': 'Créez votre liste en quelques minutes',
  'seo.ctaBody': 'Gratuit, sans publicité, sans commission. Vos proches rejoignent par un simple lien.',

  // Meta titles: short, because the layout template appends « · Kadlio » and
  // a result past ~60 characters is cut mid-word.
  'seo.wishlist.title': 'Liste de souhaits en ligne, libre et gratuite',
  'seo.wishlist.metaDescription':
    'Créez votre liste de souhaits en ligne : un lien de boutique, un prix, ou juste une idée. Vos proches réservent en secret, sans doublons. Gratuit, sans publicité.',
  'seo.wishlist.navLabel': 'Liste de souhaits',
  'seo.wishlist.h1': 'Une liste de souhaits en ligne, libre et gratuite',
  'seo.wishlist.lede':
    'Notez vos envies où qu’elles se trouvent : un lien vers n’importe quelle boutique, un prix, une photo — ou juste une phrase. Vos proches y réservent en secret ce qu’ils comptent offrir, et vous ne voyez jamais qui a pris quoi.',
  'seo.wishlist.s1Title': 'Aucune boutique imposée',
  'seo.wishlist.s1Body':
    'Une envie peut venir de n’importe où : un site marchand, une brocante, ou aucun magasin du tout — « un week-end en Islande » est un souhait parfaitement valable. Kadlio n’est lié à aucune enseigne et ne touche aucune commission.',
  'seo.wishlist.s2Title': 'Vous choisissez qui voit quoi',
  'seo.wishlist.s2Body':
    'Chaque liste a sa visibilité : privée, réservée à vos proches, ou accessible à quiconque a le lien. Vous pouvez tenir une liste pour vous et en partager une autre.',
  'seo.wishlist.s3Title': 'Des priorités, pas des consignes',
  'seo.wishlist.s3Body':
    'Marquez ce qui vous ferait vraiment plaisir et ce qui serait simplement bienvenu. Vos proches choisissent en connaissance de cause, sans que vous ayez rien organisé pour eux.',
  'seo.wishlist.faq1q': 'Est-ce vraiment gratuit ?',
  'seo.wishlist.faq1a':
    'Oui. Kadlio n’a ni publicité, ni abonnement, ni commission sur quoi que ce soit.',
  'seo.wishlist.faq2q': 'Mes proches doivent-ils créer un compte ?',
  'seo.wishlist.faq2a':
    'Oui, un compte gratuit : c’est ce qui permet de savoir qu’une envie est déjà réservée sans jamais le montrer à la personne concernée. Ils rejoignent par un lien d’invitation, en quelques instants.',
  'seo.wishlist.faq3q': 'Puis-je ajouter une envie sans lien de boutique ?',
  'seo.wishlist.faq3a':
    'Oui. Le nom suffit — le prix, la photo et la description sont optionnels. Beaucoup d’envies n’ont pas de produit derrière elles.',
  'seo.wishlist.faq4q': 'Qui peut voir ma liste ?',
  'seo.wishlist.faq4a':
    'Ce que vous décidez : vous seul, vos proches, ou toute personne disposant du lien. Ce que vous ne voyez jamais, en revanche, ce sont les réservations sur votre propre liste.',

  'seo.birth.title': 'Liste de naissance en ligne, sans magasin imposé',
  'seo.birth.metaDescription':
    'Une liste de naissance libre : la poussette d’une boutique, la veilleuse d’une autre, ou de la seconde main. Cagnotte pour l’équipement cher, sans commission.',
  'seo.birth.navLabel': 'Liste de naissance',
  'seo.birth.h1': 'Une liste de naissance sans magasin imposé',
  'seo.birth.lede':
    'Les listes de naissance classiques vous enferment dans le catalogue d’une enseigne. Sur Kadlio, chaque envie vient d’où vous voulez : une boutique en ligne, un artisan, de la seconde main — ou simplement « des couches taille 1 ».',
  'seo.birth.s1Title': 'Tout au même endroit, de n’importe où',
  'seo.birth.s1Body':
    'La poussette d’un site, le siège auto d’un autre, la gigoteuse cousue par une amie : une seule liste rassemble tout, avec un lien et un prix quand il y en a, une simple phrase quand il n’y en a pas.',
  'seo.birth.s2Title': 'L’équipement cher se finance à plusieurs',
  'seo.birth.s2Body':
    'Sur une poussette à 400 €, un proche réserve puis ouvre une cagnotte : chacun promet ce qu’il veut, l’objectif est affiché, une personne achète. L’argent ne transite jamais par Kadlio — pas de commission, pas de frais cachés.',
  'seo.birth.s3Title': 'Toute la famille, même loin',
  'seo.birth.s3Body':
    'Un lien d’invitation suffit pour que les grands-parents, les oncles et les amis rejoignent la liste. Chacun voit ce qui est déjà pris, personne n’offre deux fois la même veilleuse.',
  'seo.birth.faq1q': 'La liste de naissance est-elle gratuite ?',
  'seo.birth.faq1a':
    'Oui, entièrement : pas d’abonnement, pas de publicité, et aucune commission sur les cagnottes.',
  'seo.birth.faq2q': 'Faut-il choisir un magasin partenaire ?',
  'seo.birth.faq2a':
    'Non. Kadlio n’a aucun partenariat marchand : vous ajoutez un lien vers n’importe quelle boutique, ou aucun lien du tout.',
  'seo.birth.faq3q': 'Comment fonctionne la cagnotte pour un gros achat ?',
  'seo.birth.faq3a':
    'Les proches promettent chacun un montant jusqu’à l’objectif. Une personne achète l’article et voit alors qui a promis quoi, pour se faire rembourser directement. Aucun paiement ne passe par le site.',
  'seo.birth.faq4q': 'Voit-on ce que les proches ont choisi d’offrir ?',
  'seo.birth.faq4a':
    'Non : les réservations restent invisibles pour les parents, comme sur toute liste Kadlio. Vous gardez la main sur la liste elle-même — envies, priorités, visibilité — et découvrez les cadeaux quand on vous les offre.',

  'seo.wedding.title': 'Liste de mariage en ligne, sans commission',
  'seo.wedding.metaDescription':
    'Votre liste de mariage sans enseigne ni commission : des envies de n’importe où, une cagnotte pour le voyage de noces, des invités qui s’organisent sans doublons.',
  'seo.wedding.navLabel': 'Liste de mariage',
  'seo.wedding.h1': 'Une liste de mariage sans enseigne et sans commission',
  'seo.wedding.lede':
    'Les listes de mariage traditionnelles prélèvent leur part ou vous limitent à un catalogue. Kadlio ne vend rien et ne prélève rien : vous décrivez ce qui vous ferait plaisir, vos invités s’organisent entre eux.',
  'seo.wedding.s1Title': 'Des envies, pas un catalogue',
  'seo.wedding.s1Body':
    'Ajoutez ce que vous voulez vraiment : de la vaisselle repérée quelque part, une contribution au voyage de noces, un meuble chez un artisan. Un lien et un prix si vous les avez, une simple phrase sinon.',
  'seo.wedding.s2Title': 'Les invités se regroupent sur les grandes envies',
  'seo.wedding.s2Body':
    'Un invité réserve « Voyage de noces » et ouvre la cagnotte aux autres, avec l’objectif que vous avez indiqué. Les promesses s’additionnent à l’abri de vos regards ; l’argent circule entre eux, jamais par Kadlio.',
  'seo.wedding.s3Title': 'Un seul lien à partager',
  'seo.wedding.s3Body':
    'Votre liste s’ouvre par un lien d’invitation que vous diffusez comme vous voulez : aux témoins d’abord, à tous les invités ensuite. Chacun voit ce qui est déjà pris et ce qui reste.',
  'seo.wedding.faq1q': 'Combien coûte une liste de mariage sur Kadlio ?',
  'seo.wedding.faq1a':
    'Rien. Pas de frais d’ouverture, pas d’abonnement, et surtout aucune commission sur les cagnottes — ce qui est promis va intégralement au cadeau.',
  'seo.wedding.faq2q': 'Les invités paient-ils en ligne ?',
  'seo.wedding.faq2a':
    'Non. Une contribution est une promesse : une personne achète ou offre le montant, les autres la remboursent directement — virement, espèces, comme ils veulent. Kadlio tient le compte, pas la caisse.',
  'seo.wedding.faq3q': 'Peut-on mettre le voyage de noces sur la liste ?',
  'seo.wedding.faq3a':
    'Oui : ajoutez-le comme une envie, avec le montant en guise de prix. Vos invités réserveront et ouvriront la cagnotte dessus.',
  'seo.wedding.faq4q': 'Les invités doivent-ils créer un compte ?',
  'seo.wedding.faq4a':
    'Oui, gratuit et rapide — c’est ce qui permet de suivre qui a réservé quoi sans jamais vous le montrer.',

  'seo.group.title': 'Cadeau commun : la cagnotte sans commission',
  'seo.group.metaDescription':
    'Organisez un cadeau commun sans tableur ni relances : réservation, cagnotte avec objectif, promesses de chacun, un acheteur remboursé directement. Sans commission.',
  'seo.group.navLabel': 'Cadeau commun',
  'seo.group.h1': 'Le cadeau commun, sans tableur ni relances',
  'seo.group.lede':
    'Un cadeau à plusieurs, c’est d’habitude un fil de messages, un tableur et quelqu’un qui avance l’argent sans oser réclamer. Kadlio structure exactement ça — et rien de plus.',
  'seo.group.s1Title': 'Une réservation, puis une cagnotte ouverte',
  'seo.group.s1Body':
    'Le premier décidé réserve l’envie, puis l’ouvre aux autres avec un objectif — le prix, confirmé par celui qui a le lien de la boutique sous les yeux. Chacun promet alors le montant de son choix.',
  'seo.group.s2Title': 'Personne n’annonce son montant au groupe',
  'seo.group.s2Body':
    'Tant que le cadeau n’est pas acheté, la cagnotte n’affiche qu’un total et un nombre de participants. On choisit ce qu’on donne sans le faire sous le regard des autres.',
  'seo.group.s3Title': 'Celui qui achète est le seul à voir les comptes',
  'seo.group.s3Body':
    'Une personne achète le cadeau et le déclare. Elle seule voit alors qui a promis quoi — c’est elle qui est sortie d’argent — et chacun la rembourse directement. Aucun paiement ne transite par Kadlio.',
  'seo.group.faq1q': 'L’argent passe-t-il par Kadlio ?',
  'seo.group.faq1a':
    'Jamais. Les contributions sont des promesses ; le remboursement se fait entre vous, par virement ou autrement. Il n’y a donc ni commission ni frais.',
  'seo.group.faq2q': 'La personne à qui l’on offre peut-elle voir la cagnotte ?',
  'seo.group.faq2a':
    'Non. Sur sa propre liste, les réservations et les cagnottes ne sont jamais chargées — elle découvre le cadeau le jour venu.',
  'seo.group.faq3q': 'Que se passe-t-il si l’objectif n’est pas atteint ?',
  'seo.group.faq3a':
    'Rien d’automatique : la cagnotte reste ouverte et le groupe décide — compléter, ajuster l’objectif, ou en parler dans la conversation liée au cadeau.',
  'seo.group.faq4q': 'Comment le groupe se coordonne-t-il ?',
  'seo.group.faq4a':
    'Chaque cadeau a sa conversation, invisible pour la personne concernée. On s’y répartit qui achète, qui emballe, qui apporte.',

  // ── Legal pages ──────────────────────────────────────────────────────────
  'legal.backHome': 'Retour à l’accueil',
  'legal.updated': 'Dernière mise à jour : 25 août 2026.',
  'legal.noticeTitle': 'Mentions légales',
  'legal.publisher': 'Éditeur',
  'legal.publisherBody':
    'Kadlio est édité par un particulier, à titre non professionnel, sans publicité et sans revenus. Conformément à l’article 6-III-2 de la loi pour la confiance dans l’économie numérique, son identité n’est pas publiée ici : elle est détenue par l’hébergeur, qui la communiquera sur réquisition de l’autorité judiciaire.',
  'legal.director': 'Directeur de la publication',
  'legal.directorBody': 'L’éditeur, dans les mêmes conditions d’anonymat que ci-dessus.',
  'legal.host': 'Hébergeur',
  'legal.hostDataBody':
    'Les données sont stockées chez Neon (base de données) et Vercel (fichiers envoyés), sur des serveurs situés dans l’Union européenne.',
  'legal.contact': 'Contact',

  'legal.privacyTitle': 'Politique de confidentialité',
  'legal.privacyIntro':
    'Cette page décrit ce que Kadlio enregistre à votre sujet, pourquoi, combien de temps, et ce que vous pouvez exiger. Elle décrit le fonctionnement réel de l’application, pas un modèle.',
  'legal.controller': 'Responsable de traitement',
  'legal.controllerBody':
    'L’éditeur de Kadlio, joignable à contact@kadlio.com pour toute question ou demande relative à vos données.',
  'legal.collected': 'Ce qui est enregistré',
  'legal.collectedAccount':
    'Compte : votre adresse e-mail, votre nom, et votre mot de passe sous forme chiffrée — jamais en clair, y compris pour nous.',
  'legal.collectedOptional':
    'Facultatif : une courte présentation, une photo de profil, vos centres d’intérêt, les dates que vous choisissez de publier (un mariage, une remise de diplôme, ce que vous voulez), un GIF de décoration. Rien de tout cela n’est obligatoire, et tout est modifiable ou supprimable à tout moment.',
  'legal.collectedSurvey':
    'Questionnaire d’inscription : à la création du compte, nous vous proposons d’indiquer vos centres d’intérêt, votre sexe et votre tranche d’âge. Les trois sont facultatifs, l’étape entière peut être passée, et ne pas répondre est enregistré comme une absence de réponse — pas comme une catégorie. Ces informations servent uniquement à vous proposer des idées de cadeaux : elles ne sont affichées nulle part, ni sur votre profil, ni à vos proches. Une tranche d’âge est demandée plutôt qu’une date de naissance parce qu’une date identifie une personne, ce dont les suggestions n’ont pas besoin. Aucune donnée sensible au sens de l’article 9 du RGPD n’est demandée : ni religion, ni santé, ni origine, ni opinion politique, ni orientation sexuelle.',
  'legal.collectedUse':
    'Usage : vos listes, vos envies, vos amis, vos réservations, vos participations aux cagnottes et vos messages dans les salons privés.',
  'legal.collectedTech':
    'Technique : un journal des ajouts, réservations, participations et clics vers les boutiques, utilisé pour les suggestions de cadeaux ; et les tentatives de connexion, conservées 24 heures pour limiter les attaques par force brute.',
  'legal.outbound': 'Les liens vers les boutiques',
  'legal.outboundBody':
    'Quand vous ouvrez le lien d’une boutique depuis une envie, nous enregistrons que ce clic a eu lieu : la date, la boutique concernée et votre compte. Cela sert à deux choses — améliorer les suggestions de cadeaux, et savoir combien de visites nous envoyons à chaque boutique. Ce journal n’est jamais montré au propriétaire de la liste : s’il pouvait voir qu’on a cliqué sur le lien d’une de ses envies, il apprendrait qu’elle intéresse quelqu’un. Vos propres clics sur vos propres envies ne sont pas enregistrés. Aucun identifiant n’est ajouté au lien : la boutique reçoit exactement l’adresse que vous avez collée, et n’apprend rien de nous.',
  'legal.why': 'Pourquoi, et sur quelle base',
  'legal.whyBody':
    'Pour exécuter le service que vous avez demandé en créant un compte (article 6.1.b du RGPD) : sans ces données, il n’y a ni liste, ni ami, ni cadeau. Les réponses au questionnaire d’inscription reposent sur votre consentement (article 6.1.a), donné en répondant et retirable à tout moment en effaçant vos réponses depuis votre profil — le service fonctionne à l’identique sans elles. La limitation des tentatives de connexion repose sur l’intérêt légitime à protéger les comptes (article 6.1.f).',
  'legal.retention': 'Combien de temps',
  'legal.retentionBody':
    'Vos données sont conservées tant que votre compte existe. Une session expire au bout de 30 jours. Les tentatives de connexion sont effacées au bout de 24 heures. Un lien de réinitialisation de mot de passe expire au bout d’une heure et ne sert qu’une fois. À la suppression de votre compte, tout est effacé immédiatement : listes, envies, réservations, participations, messages, photos et journal d’activité. Rien n’est conservé sous forme anonymisée.',
  'legal.thirdParties': 'Qui d’autre voit quelque chose',
  'legal.thirdPartiesBody':
    'Vercel héberge l’application, stocke les photos que vous envoyez et en mesure l’audience et la vitesse — voir la section suivante. Neon héberge la base de données, dans l’Union européenne. Quand vous cherchez un GIF, la requête part chez GIPHY, et les GIFs affichés sur un profil sont chargés depuis leurs serveurs — GIPHY voit donc les visites sur ce profil. Quand vous collez un lien de boutique que le marchand nous refuse, l’adresse de la page est transmise à un service de lecture externe (r.jina.ai) pour en récupérer le titre et le prix. L’e-mail de réinitialisation de mot de passe est acheminé par Resend, un prestataire américain certifié au titre du cadre de protection des données UE–États-Unis (Data Privacy Framework) : il voit votre adresse et le contenu de ce message, rien d’autre. Aucune donnée n’est vendue, louée, ni transmise à des fins publicitaires.',
  'legal.cookies': 'Cookies',
  'legal.cookiesBody':
    'Un seul cookie est déposé : celui qui vous maintient connecté. Il est strictement nécessaire au fonctionnement du service. Aucun cookie publicitaire, aucun cookie de réseau social, aucun traceur tiers. C’est pourquoi aucun bandeau ne vous est demandé.',
  'legal.measurement': 'Mesure d’audience et performance',
  'legal.measurementBody':
    'Deux outils de Vercel, l’hébergeur, sont actifs. Speed Insights mesure la vitesse d’affichage des pages : uniquement des durées, sans identifiant ni suivi d’une page à l’autre. Web Analytics compte les pages vues, les pays et les types d’appareils : il ne dépose pas de cookie et ne conserve pas votre adresse IP, mais il en dérive un identifiant temporaire, renouvelé chaque jour, pour distinguer les visites. Ces mesures servent à savoir si l’application est lente ou utilisée, jamais à vous profiler, et rien n’est revendu ni partagé à des fins publicitaires. Vous pouvez les bloquer avec n’importe quel bloqueur de contenu, sans que l’application cesse de fonctionner.',
  'legal.rights': 'Vos droits',
  'legal.rightsBody':
    'Vous pouvez accéder à vos données, les corriger, les effacer, en limiter l’usage ou vous opposer à leur traitement. L’essentiel se fait directement dans l’application : votre profil est modifiable, et la suppression de compte dans les Réglages efface tout, sans délai ni confirmation par e-mail. Pour le reste, écrivez à contact@kadlio.com. Vous pouvez également saisir la CNIL.',
  'legal.secretNote': 'Une précision sur le secret',
  'legal.secretNoteBody':
    'Kadlio est conçu pour que le propriétaire d’une liste ne puisse pas savoir qui a réservé quoi. Ce n’est pas une promesse de discrétion : les réservations ne sont jamais chargées lorsque c’est lui qui consulte la page. Vos participations à une cagnotte ne sont visibles nominativement que par la personne qui déclare avoir acheté le cadeau, et uniquement à ce moment-là.',

  'legal.termsTitle': 'Conditions d’utilisation',
  'legal.termsIntro':
    'En créant un compte sur Kadlio, vous acceptez ce qui suit. Le service est gratuit et fourni tel quel.',
  'legal.termsAccess': 'Accès au service',
  'legal.termsAccessBody':
    'Kadlio est gratuit, sans publicité et sans engagement. Il faut avoir au moins 15 ans pour créer un compte. Vous êtes responsable de la confidentialité de votre mot de passe.',
  'legal.termsContent': 'Ce que vous publiez',
  'legal.termsContentBody':
    'Vous restez propriétaire de ce que vous écrivez et envoyez. Vous vous engagez à ne rien publier d’illégal, haineux ou portant atteinte aux droits d’autrui, y compris dans les salons de discussion privés.',
  'legal.termsImages': 'Photos',
  'legal.termsImagesBody':
    'Les photos que vous envoyez — photo de profil, images d’envies — doivent convenir à tout public. Sont notamment interdits les contenus à caractère sexuel, violents ou choquants. Ces images ne sont pas analysées automatiquement : c’est votre responsabilité, et celle des personnes qui les voient de nous les signaler. Par ailleurs, lorsqu’une envie renvoie vers une boutique, l’image que cette boutique déclare elle-même pour son produit peut être affichée afin de présenter l’article lié. Ces visuels restent la propriété de leurs boutiques ; tout ayant droit peut en demander le retrait à l’adresse de contact des mentions légales, et il sera effectué sans délai.',
  'legal.termsReport': 'Signalement',
  'legal.termsReportBody':
    'Un lien « Signaler » figure sous chaque profil et chaque envie que vous consultez. Le signalement est confidentiel : la personne concernée n’en est pas informée et ne peut pas savoir qui l’a signalée. Un contenu manifestement en infraction est retiré et le compte concerné peut être suspendu.',
  'legal.termsAvailability': 'Disponibilité',
  'legal.termsAvailabilityBody':
    'Le service est fourni sans garantie de disponibilité. Il peut être interrompu, modifié ou arrêté, notamment pour maintenance. Les prix affichés à partir de liens marchands sont des indications reprises de pages externes : ils peuvent être faux ou périmés, et n’engagent ni Kadlio ni le marchand.',
  'legal.termsEnd': 'Fin',
  'legal.termsEndBody':
    'Vous pouvez supprimer votre compte à tout moment depuis les Réglages ; l’effacement est immédiat et définitif. Ces conditions sont soumises au droit français.',

  'legal.footerNotice': 'Mentions légales',
  'legal.footerPrivacy': 'Confidentialité',
  'legal.footerTerms': 'Conditions',

  'report.link': 'Signaler',
  'report.title': 'Signaler ce contenu',
  'report.intro': 'Dites-nous ce qui ne va pas. La personne concernée n’en saura rien.',
  'report.placeholder': 'Photo inappropriée, propos déplacés…',
  'report.send': 'Envoyer le signalement',
  'report.sending': 'Envoi…',
  'report.thanks': 'Merci. Nous allons regarder.',
  'report.cancel': 'Annuler',
  'error.cannotReportYourself': 'Vous ne pouvez pas vous signaler vous-même.',

  // ── Invitations, uploads, search ─────────────────────────────────────────
  // The invitation landing is most newcomers' FIRST contact with Kadlio —
  // they arrive from a group chat and never see the landing page. So this
  // is where the concept gets its one sentence, and what the invitee gains
  // for themselves its other one.
  'invite.title': '{name} vous invite sur Kadlio',
  // Tight on purpose: an invitee gives this card three seconds. The title
  // already says "Kadlio", so the body spends no words repeating it — one
  // sentence carries what it is, that it is free, and the secret rule.
  'invite.concept':
    'Une liste de cadeaux entre proches, gratuite : {name} y note ses envies, vous réservez en secret — et {name} ne voit jamais qui a pris quoi.',
  'invite.reciprocal': 'Vos envies auront leur liste aussi.',
  'invite.haveAccount': 'J’ai déjà un compte',
  'invite.unused': 'Personne ne l’a encore utilisé.',
  'invite.rotate': 'Générer un nouveau lien',
  'invite.rotating': 'Un instant…',
  'upload.tooLarge': 'Cette image dépasse 4 Mo.',
  'search.placeholder': 'Nom ou adresse e-mail',
  'gif.placeholder': 'Chercher : chat, merci, bravo…',
  'gif.choose': 'Choisir ce GIF',
  'gif.chooseNamed': 'Choisir le GIF : {title}',
  'gif.unconfigured':
    'La recherche de GIFs n’est pas encore configurée sur ce serveur.',
  'gif.failed': 'La recherche n’a pas répondu. Réessayez dans un instant.',
  'gif.resultCount': {
    one: '{count} GIF trouvé',
    other: '{count} GIFs trouvés',
  },
  'account.confirmDelete':
    'Supprimer définitivement votre compte et toutes vos données ? Cette action est irréversible.',

  // ── Invitations ──────────────────────────────────────────────────────────
  'invite.unknownTitle': 'Cette invitation n’existe pas',
  'invite.closedTitle': 'Cette invitation a été fermée',
  'invite.goHome': 'Aller à l’accueil',
  'invite.seeFriends': 'Voir mes amis',
} satisfies Record<string, string | Plural>;
