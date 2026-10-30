// Inferred gender for the Contacts v2 filter. There is no gender column —
// this is first-name only, and anything we don't recognize is "unknown".
// Do not invent a stored field.

export type ContactGender = "women" | "men" | "unknown";

const WOMEN = new Set(
  [
    "aaliyah", "abbey", "abby", "abigail", "ada", "addison", "adriana", "adrienne", "aileen", "aimee",
    "alana", "alecia", "alejandra", "alexa", "alexandra", "alexis", "alice", "alicia", "alina", "alison",
    "allison", "alyssa", "amanda", "amber", "amelia", "amira", "amy", "ana", "anastasia", "andrea",
    "angela", "angelica", "angelina", "angie", "anita", "ann", "anna", "annabelle", "anne", "annette",
    "annie", "anthonya", "anya", "april", "aria", "ariana", "arianna", "ariel", "arlene", "asha",
    "asianna", "ashley", "ashlyn", "ashton", "asia", "athena", "aubrey", "audrey", "aurora", "autumn",
    "ava", "avery", "ayesha", "bailey", "barbara", "beatrice", "becky", "belinda", "bella", "bernice",
    "beth", "bethany", "betty", "beverly", "bianca", "bonnie", "brandy", "breanna", "brenda", "briana",
    "brianna", "bridget", "brittany", "brittney", "brooke", "brooklyn", "caitlin", "caitlyn", "callie",
    "camila", "camille", "candace", "candice", "cara", "carla", "carly", "carmen", "carol", "carolina",
    "caroline", "carolyn", "carrie", "casey", "cassandra", "cassie", "catherine", "cathy", "cayla",
    "cecilia", "celeste", "celia", "charlene", "charlotte", "chelsea", "chelsey", "cheri", "cheryl",
    "cheyenne", "chloe", "christina", "christine", "cindy", "claire", "clara", "clarissa", "claudia",
    "colleen", "connie", "constance", "cora", "courtney", "crystal", "cynthia", "daisy", "dakota",
    "dana", "daniela", "danielle", "daphne", "darlene", "deanna", "debbie", "deborah", "debra", "delilah",
    "denise", "desiree", "destiny", "diana", "diane", "dianne", "donna", "dora", "doris", "dorothy",
    "eden", "eileen", "elaine", "eleanor", "elena", "elisa", "elisabeth", "elise", "eliza", "elizabeth",
    "ella", "ellen", "ellie", "eloise", "elsa", "elsie", "elyse", "emilia", "emily", "emma", "erica",
    "erika", "erin", "esther", "ethel", "eva", "evelyn", "faith", "farrah", "fatima", "faye", "felicia",
    "fiona", "florence", "frances", "francesca", "gabriela", "gabrielle", "gail", "genesis", "genevieve",
    "georgia", "geraldine", "gina", "ginger", "giselle", "gladys", "glenda", "gloria", "grace", "gracie",
    "gretchen", "gwen", "gwendolyn", "hailey", "haley", "hannah", "harley", "harmony", "harper", "hazel",
    "heather", "heidi", "helen", "helena", "holly", "hope", "ida", "imani", "ingrid", "irene", "iris",
    "irma", "isabel", "isabella", "isabelle", "ivy", "jackie", "jacqueline", "jade", "jamie", "jane",
    "janet", "janice", "jasmine", "jean", "jeanette", "jeanne", "jenna", "jennifer", "jenny", "jessica",
    "jill", "jillian", "jo", "joan", "joann", "joanna", "joanne", "jocelyn", "jodi", "jody", "jordan",
    "josephine", "joy", "joyce", "judith", "judy", "julia", "juliana", "julie", "juliet", "june",
    "justice", "justine", "kaitlin", "kaitlyn", "kami", "kara", "karen", "kari", "karina", "karla",
    "katelyn", "katherine", "kathleen", "kathryn", "kathy", "katie", "katrina", "kay", "kayla", "kaylee",
    "keisha", "kelli", "kellie", "kelly", "kelsey", "kendall", "kendra", "kenya", "kerri", "kerry",
    "kim", "kimberly", "kirsten", "krista", "kristen", "kristi", "kristin", "kristina", "kristine",
    "krystal", "kylie", "lacey", "laila", "lana", "lara", "latoya", "laura", "lauren", "laurie", "leah",
    "leandra", "leia", "leila", "lena", "leona", "lesley", "leslie", "leticia", "lila", "liliana",
    "lillian", "lilly", "lily", "linda", "lindsay", "lindsey", "lisa", "liz", "liza", "lizzie", "logan",
    "lois", "lola", "lori", "lorraine", "louise", "lucia", "lucille", "lucy", "luna", "lydia", "lynn",
    "mabel", "mackenzie", "macy", "maddie", "madeline", "madelyn", "madison", "mae", "maggie", "makayla",
    "mallory", "mandy", "mara", "marcella", "marcia", "margaret", "margarita", "maria", "mariah", "marian",
    "marianne", "marie", "marilyn", "marina", "marioa", "marisa", "marisol", "marissa", "marjorie",
    "marlene", "marsha", "marta", "martha", "mary", "maryann", "matilda", "maureen", "maxine", "maya",
    "megan", "meghan", "melanie", "melinda", "melissa", "melody", "mercedes", "meredith", "mia", "michaela",
    "michelle", "mikaela", "mikayla", "mildred", "mindy", "miranda", "miriam", "molly", "mona", "monica",
    "monique", "morgan", "muriel", "myra", "myrtle", "nadia", "nancy", "naomi", "natalia", "natalie",
    "natasha", "nichole", "nicole", "nina", "noelle", "nora", "norma", "olga", "olive", "olivia", "paige",
    "pam", "pamela", "patrice", "patricia", "patsy", "patti", "patty", "paula", "pauline", "payton",
    "pearl", "peggy", "penelope", "penny", "phyllis", "piper", "priscilla", "rachael", "rachel", "ramona",
    "randi", "raquel", "reagan", "reba", "rebecca", "rebekah", "regina", "renee", "rhonda", "ria", "riley",
    "rita", "roberta", "robin", "robyn", "rochelle", "rosa", "rosalie", "rose", "rosemary", "rosie",
    "roxanne", "ruby", "ruth", "sabrina", "sadie", "sally", "samantha", "sandra", "sandy", "sara", "sarah",
    "sasha", "savannah", "selena", "selma", "serena", "shannon", "shari", "sharon", "shauna", "shawna",
    "sheila", "shelby", "shelley", "shelly", "sheri", "sherri", "sherry", "sheryl", "shirley", "sierra",
    "skylar", "sofia", "sondra", "sonia", "sonya", "sophia", "sophie", "stacey", "stacy", "stefanie",
    "stella", "stephanie", "sue", "summer", "susan", "susanne", "suzanne", "sydney", "sylvia", "tabitha",
    "tamara", "tami", "tammy", "tania", "tanya", "tara", "tasha", "taylor", "teresa", "teri", "terra",
    "terri", "terry", "tess", "tessa", "thea", "thelma", "theresa", "tiffany", "tina", "toni", "tonya",
    "tracey", "traci", "tracy", "tricia", "trina", "trisha", "valerie", "vanessa", "vera", "verna",
    "veronica", "vicki", "vickie", "victoria", "viola", "violet", "virginia", "vivian", "wanda", "wendy",
    "whitney", "willow", "wilma", "winifred", "winnie", "yasmin", "yesenia", "yolanda", "yvette", "yvonne",
    "zoe", "zoey",
  ].map((n) => n.toLowerCase()),
);

const MEN = new Set(
  [
    "aaron", "adam", "adrian", "alan", "albert", "alberto", "alec", "alejandro", "alex", "alexander",
    "alfred", "ali", "allan", "allen", "alvin", "andre", "andres", "andrew", "andy", "angel", "angelo",
    "anthony", "antonio", "archie", "arthur", "austin", "barry", "ben", "benjamin", "bernard", "bill",
    "billy", "blaine", "blake", "bob", "bobby", "brad", "bradley", "brandon", "brendan", "brent", "brett",
    "brian", "bruce", "bryan", "bryce", "caleb", "calvin", "cameron", "carl", "carlos", "carter", "cecil",
    "cesar", "chad", "charles", "charlie", "chase", "chester", "chris", "christian", "christopher", "clarence",
    "clark", "claude", "clayton", "clifford", "clinton", "clyde", "cody", "colin", "collin", "conner",
    "connor", "corey", "cory", "craig", "curtis", "dale", "dallas", "damian", "damon", "dan", "daniel",
    "danny", "darius", "darrell", "darren", "darryl", "daryl", "dave", "david", "dean", "dennis", "derek",
    "derrick", "devin", "devon", "diego", "dominic", "don", "donald", "douglas", "drew", "duane", "dustin",
    "dwayne", "dwight", "dylan", "earl", "eddie", "edgar", "edward", "edwin", "eli", "elias", "elijah",
    "elliot", "elliott", "elmer", "emmanuel", "eric", "erik", "ernest", "ethan", "eugene", "evan", "everett",
    "ezekiel", "ezra", "felix", "fernando", "floyd", "francis", "francisco", "frank", "franklin", "fred",
    "frederick", "gabriel", "garrett", "gary", "gavin", "gene", "geoffrey", "george", "gerald", "gilbert",
    "glen", "glenn", "gordon", "grant", "greg", "gregory", "guy", "harold", "harry", "harvey", "hayden",
    "hector", "henry", "herbert", "herman", "howard", "hugh", "hunter", "ian", "isaac", "isaiah", "ivan",
    "jack", "jackson", "jacob", "jake", "james", "jared", "jason", "javier", "jay", "jd", "jeff", "jeffery",
    "jeffrey", "jeremiah", "jeremy", "jerome", "jerry", "jesse", "jesus", "jim", "jimmy", "jody", "joe",
    "joel", "john", "johnathan", "johnny", "jon", "jonathan", "jonathon", "jordan", "jorge", "jose",
    "joseph", "josh", "joshua", "juan", "julian", "julio", "justin", "karl", "keith", "ken", "kenneth",
    "kenny", "kent", "kevin", "kirk", "kurt", "kyle", "lance", "larry", "lawrence", "lee", "leo", "leon",
    "leonard", "leroy", "leslie", "lester", "levi", "lewis", "liam", "lloyd", "lonnie", "louis", "lucas",
    "luis", "luke", "malcolm", "manuel", "marc", "marco", "marcus", "mario", "mark", "marshall", "martin",
    "marvin", "mason", "mathew", "matt", "matthew", "maurice", "max", "melvin", "michael", "micheal",
    "miguel", "mike", "mitchell", "mohamed", "mohammad", "mohammed", "nathan", "nathaniel", "neil", "nelson",
    "nicholas", "nick", "nicolas", "noah", "norman", "oliver", "omar", "oscar", "owen", "pablo", "patrick",
    "paul", "pedro", "perry", "peter", "phil", "philip", "phillip", "preston", "ralph", "ramon", "randall",
    "randy", "raul", "ray", "raymond", "reginald", "ricardo", "richard", "rick", "ricky", "roberto", "robert",
    "robin", "rodney", "roger", "roland", "ron", "ronald", "ronnie", "ross", "roy", "ruben", "russell",
    "ryan", "salvador", "sam", "samuel", "scott", "sean", "sergio", "seth", "shane", "shannon", "shaun",
    "shawn", "sidney", "spencer", "stanley", "stephen", "steve", "steven", "stuart", "ted", "terence",
    "terrance", "terrell", "terry", "theodore", "thomas", "tim", "timothy", "todd", "tom", "tommy", "tony",
    "tracy", "travis", "trent", "trevor", "troy", "tyler", "tyrone", "tyson", "vernon", "victor", "vincent",
    "virgil", "wade", "wallace", "walter", "warren", "wayne", "wesley", "willard", "william", "willie",
    "wyatt", "xavier", "zachary", "zach",
  ].map((n) => n.toLowerCase()),
);

// Unisex names that appear in both lists stay unknown so we don't guess.
const UNISEX = new Set(
  [...WOMEN].filter((n) => MEN.has(n)),
);

function firstNameKey(firstName: string | null | undefined): string {
  return (firstName ?? "").trim().split(/\s+/)[0]?.replace(/[^a-zA-Z'-]/g, "").toLowerCase() ?? "";
}

export function inferContactGender(firstName: string | null | undefined): ContactGender {
  const key = firstNameKey(firstName);
  if (!key) return "unknown";
  if (UNISEX.has(key)) return "unknown";
  if (WOMEN.has(key)) return "women";
  if (MEN.has(key)) return "men";
  return "unknown";
}

export function contactMatchesGender(firstName: string | null | undefined, gender: ContactGender | undefined): boolean {
  if (!gender) return true;
  return inferContactGender(firstName) === gender;
}
