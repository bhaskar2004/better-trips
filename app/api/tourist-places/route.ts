import { type NextRequest, NextResponse } from "next/server"

const API_KEY = process.env.GEOAPIFY_API_KEY
const cache = new Map<string, { data: unknown; ts: number }>()
const TTL_MS = 120000

interface GeoapifyPlace {
  properties: {
    name?: string
    categories: string[]
    address_line1?: string
    address_line2?: string
    city?: string
    country?: string
    formatted?: string
    lat?: number
    lon?: number
    datasource?: {
      raw?: {
        rating?: number
        name?: string
        alt_name?: string
        official_name?: string
        loc_name?: string
      }
    }
  }
}

interface ProcessedPlace {
  name: string
  categories: string[]
  address: string
  lat: number | undefined
  lon: number | undefined
  priority: number
}

// Famous tourist destinations and their priority scores
const FAMOUS_PLACES: { [key: string]: { name: string; priority: number; categories: string[] }[] } = {
  "chikkaballapura": [
    { name: "Nandi Hills", priority: 100, categories: ["tourism.attraction", "natural", "tourism.sights"] },
    { name: "Nandi Fort", priority: 95, categories: ["tourism.sights", "building.historic", "tourism.attraction"] },
    { name: "Bhoga Nandishwara Temple", priority: 90, categories: ["religion.place_of_worship", "building.historic", "tourism.sights"] },
    { name: "Skandagiri", priority: 85, categories: ["tourism.attraction", "natural", "tourism.sights"] },
    { name: "Chitravathi River", priority: 80, categories: ["natural.water", "tourism.attraction"] }
  ],
  "bangalore": [
    { name: "Lalbagh Botanical Garden", priority: 100, categories: ["leisure.park", "tourism.attraction", "natural"] },
    { name: "Cubbon Park", priority: 95, categories: ["leisure.park", "tourism.attraction", "natural"] },
    { name: "Bangalore Palace", priority: 90, categories: ["building.historic", "tourism.sights", "tourism.attraction"] },
    { name: "Vidhana Soudha", priority: 85, categories: ["building.historic", "tourism.sights"] },
    { name: "ISKCON Temple", priority: 80, categories: ["religion.place_of_worship", "tourism.attraction"] }
  ],
  "mysore": [
    { name: "Mysore Palace", priority: 100, categories: ["building.historic", "tourism.sights", "tourism.attraction"] },
    { name: "Chamundi Hills", priority: 95, categories: ["tourism.attraction", "natural", "religion.place_of_worship"] },
    { name: "Brindavan Gardens", priority: 90, categories: ["leisure.park", "tourism.attraction", "natural"] },
    { name: "St. Philomena's Cathedral", priority: 85, categories: ["religion.place_of_worship", "building.historic"] },
    { name: "Mysore Zoo", priority: 80, categories: ["entertainment.zoo", "tourism.attraction"] }
  ],
  "goa": [
    { name: "Basilica of Bom Jesus", priority: 100, categories: ["religion.place_of_worship", "building.historic", "tourism.sights"] },
    { name: "Fort Aguada", priority: 95, categories: ["tourism.sights", "building.historic", "tourism.attraction"] },
    { name: "Dudhsagar Falls", priority: 90, categories: ["natural.water", "tourism.attraction", "natural"] },
    { name: "Calangute Beach", priority: 85, categories: ["natural.water", "tourism.attraction", "leisure.beach"] },
    { name: "Old Goa Churches", priority: 80, categories: ["religion.place_of_worship", "building.historic", "tourism.sights"] }
  ],
  "hampi": [
    { name: "Virupaksha Temple", priority: 100, categories: ["religion.place_of_worship", "building.historic", "tourism.sights"] },
    { name: "Vijaya Vittala Temple", priority: 95, categories: ["religion.place_of_worship", "building.historic", "tourism.sights"] },
    { name: "Hampi Bazaar", priority: 90, categories: ["tourism.attraction", "building.historic", "tourism.sights"] },
    { name: "Lotus Mahal", priority: 85, categories: ["building.historic", "tourism.sights", "tourism.attraction"] },
    { name: "Elephant Stables", priority: 80, categories: ["building.historic", "tourism.sights"] }
  ],
  "tirupati": [
    { name: "Tirumala Temple", priority: 100, categories: ["religion.place_of_worship", "building.historic", "tourism.sights"] },
    { name: "Sri Venkateswara Temple", priority: 95, categories: ["religion.place_of_worship", "building.historic", "tourism.sights"] },
    { name: "Tirupati Balaji Temple", priority: 90, categories: ["religion.place_of_worship", "building.historic", "tourism.sights"] },
    { name: "Alipiri Mettu", priority: 85, categories: ["tourism.attraction", "natural", "tourism.sights"] },
    { name: "Sri Govindaraja Swamy Temple", priority: 80, categories: ["religion.place_of_worship", "building.historic"] }
  ],
  "hyderabad": [
    { name: "Charminar", priority: 100, categories: ["building.historic", "tourism.sights", "tourism.attraction"] },
    { name: "Golconda Fort", priority: 95, categories: ["building.historic", "tourism.sights", "tourism.attraction"] },
    { name: "Hussain Sagar", priority: 90, categories: ["natural.water", "tourism.attraction", "tourism.sights"] },
    { name: "Qutb Shahi Tombs", priority: 85, categories: ["building.historic", "tourism.sights", "tourism.attraction"] },
    { name: "Salar Jung Museum", priority: 80, categories: ["entertainment.museum", "tourism.attraction"] }
  ],
  "mumbai": [
    { name: "Gateway of India", priority: 100, categories: ["building.historic", "tourism.sights", "tourism.attraction"] },
    { name: "Marine Drive", priority: 95, categories: ["tourism.attraction", "natural.water", "tourism.sights"] },
    { name: "Juhu Beach", priority: 90, categories: ["leisure.beach", "tourism.attraction", "natural.water"] },
    { name: "Elephanta Caves", priority: 85, categories: ["tourism.sights", "building.historic", "tourism.attraction"] },
    { name: "Taj Mahal Palace", priority: 80, categories: ["building.historic", "tourism.sights", "tourism.attraction"] }
  ]
}

export async function POST(request: NextRequest) {
  try {
    console.log("API route called")
    const { placeName } = await request.json()
    console.log("Place name received:", placeName)

    if (!placeName) {
      return NextResponse.json({ error: "Place name is required" }, { status: 400 })
    }

    const normalizedPlaceName = placeName.trim().toLowerCase().replace(/\s+/g, " ")

    const placeVariations: { [key: string]: string } = {}
    Object.assign(placeVariations, {
  // Famous pilgrimage and religious destinations
  mantralaya: "Mantralayam, Andhra Pradesh, India",
  tirupati: "Tirupati, Andhra Pradesh, India",
  tirumala: "Tirumala, Andhra Pradesh, India",
  hampi: "Hampi, Karnataka, India",
  mysore: "Mysuru, Karnataka, India",
  mysuru: "Mysuru, Karnataka, India",
  bangalore: "Bengaluru, Karnataka, India",
  bengaluru: "Bengaluru, Karnataka, India",
  kashi: "Varanasi, Uttar Pradesh, India",
  ayodhya: "Ayodhya, Uttar Pradesh, India",
  mathura: "Mathura, Uttar Pradesh, India",
  vrindavan: "Vrindavan, Uttar Pradesh, India",
  badrinath: "Badrinath, Uttarakhand, India",
  kedarnath: "Kedarnath, Uttarakhand, India",
  dwarka: "Dwarka, Gujarat, India",
  somnath: "Somnath, Gujarat, India",
  jagannath: "Puri, Odisha, India",
  rameswaram: "Rameswaram, Tamil Nadu, India",
  kanchipuram: "Kanchipuram, Tamil Nadu, India",
  chidambaram: "Chidambaram, Tamil Nadu, India",
  guruvayur: "Guruvayur, Kerala, India",
  sabarimala: "Sabarimala, Kerala, India",
  shirdi: "Shirdi, Maharashtra, India",
  pandharpur: "Pandharpur, Maharashtra, India",
  ajanta: "Ajanta Caves, Maharashtra, India",
  ellora: "Ellora Caves, Maharashtra, India",
  "ajanta caves": "Ajanta Caves, Maharashtra, India",
  "ellora caves": "Ellora Caves, Maharashtra, India",
  "golden temple": "Golden Temple, Amritsar, Punjab, India",
  bodh_gaya: "Bodh Gaya, Bihar, India",
  "bodh gaya": "Bodh Gaya, Bihar, India",
  pushkar: "Pushkar, Rajasthan, India",
  ujjain: "Ujjain, Madhya Pradesh, India",
  omkareshwar: "Omkareshwar, Madhya Pradesh, India",
  khajuraho: "Khajuraho, Madhya Pradesh, India",
  srisailam: "Srisailam, Andhra Pradesh, India",
  vijayawada: "Vijayawada, Andhra Pradesh, India",
  simhachalam: "Simhachalam, Visakhapatnam, Andhra Pradesh, India",
  bhadrachalam: "Bhadrachalam, Telangana, India",
  yadagirigutta: "Yadagirigutta, Telangana, India",
  basara: "Basara, Telangana, India",
  vemulawada: "Vemulawada, Telangana, India",
  dharmasthala: "Dharmasthala, Karnataka, India",
  udupi: "Udupi, Karnataka, India",
  gokarna: "Gokarna, Karnataka, India",
  sringeri: "Sringeri, Karnataka, India",
  
  });
  Object.assign(placeVariations, {
  // Educational Institutions - Karnataka
  "sjc institute": "Sri Jagadguru Chandrashekaranatha Swamiji Institute of Technology, Karnataka, India",
  "sjc institute of technology": "Sri Jagadguru Chandrashekaranatha Swamiji Institute of Technology, Karnataka, India",
  sjcit: "Sri Jagadguru Chandrashekaranatha Swamiji Institute of Technology, Karnataka, India",
  rvce: "RV College of Engineering, Bangalore, Karnataka, India",
  "rv college": "RV College of Engineering, Bangalore, Karnataka, India",
  "bms college": "BMS College of Engineering, Bangalore, Karnataka, India",
  bmsce: "BMS College of Engineering, Bangalore, Karnataka, India",
  msrit: "MS Ramaiah Institute of Technology, Bangalore, Karnataka, India",
  "ramaiah institute": "MS Ramaiah Institute of Technology, Bangalore, Karnataka, India",
  pesit: "PES Institute of Technology, Bangalore, Karnataka, India",
  "pes institute": "PES Institute of Technology, Bangalore, Karnataka, India",
  "pes university": "PES University, Bangalore, Karnataka, India",
  cmrit: "CMR Institute of Technology, Bangalore, Karnataka, India",
  "nie mysore": "National Institute of Engineering, Mysuru, Karnataka, India",
  "sjce mysore": "Sri Jayachamarajendra College of Engineering, Mysuru, Karnataka, India",
  "nitte meenakshi": "Nitte Meenakshi Institute of Technology, Bangalore, Karnataka, India",
  "manipal institute": "Manipal Institute of Technology, Manipal, Karnataka, India",
  mit: "Manipal Institute of Technology, Manipal, Karnataka, India",
  "christ university": "Christ University, Bangalore, Karnataka, India",
  
  });
  Object.assign(placeVariations, {
  // Educational Institutions - Tamil Nadu
  "iit madras": "Indian Institute of Technology, Chennai, Tamil Nadu, India",
  iitm: "Indian Institute of Technology, Chennai, Tamil Nadu, India",
  "nit trichy": "National Institute of Technology, Tiruchirappalli, Tamil Nadu, India",
  nitt: "National Institute of Technology, Tiruchirappalli, Tamil Nadu, India",
  "anna university": "Anna University, Chennai, Tamil Nadu, India",
  "ceg chennai": "College of Engineering Guindy, Chennai, Tamil Nadu, India",
  "psg tech": "PSG College of Technology, Coimbatore, Tamil Nadu, India",
  "vit vellore": "Vellore Institute of Technology, Vellore, Tamil Nadu, India",
  vit: "Vellore Institute of Technology, Vellore, Tamil Nadu, India",
  "srm university": "SRM Institute of Science and Technology, Chennai, Tamil Nadu, India",
  "thiagarajar college": "Thiagarajar College of Engineering, Madurai, Tamil Nadu, India",
  "mit chennai": "Madras Institute of Technology, Chennai, Tamil Nadu, India",
  
  });
  Object.assign(placeVariations, {
  // Educational Institutions - Maharashtra
  "iit bombay": "Indian Institute of Technology, Mumbai, Maharashtra, India",
  iitb: "Indian Institute of Technology, Mumbai, Maharashtra, India",
  "vjti mumbai": "Veermata Jijabai Technological Institute, Mumbai, Maharashtra, India",
  vjti: "Veermata Jijabai Technological Institute, Mumbai, Maharashtra, India",
  "coep pune": "College of Engineering Pune, Maharashtra, India",
  coep: "College of Engineering Pune, Maharashtra, India",
  "vnit nagpur": "Visvesvaraya National Institute of Technology, Nagpur, Maharashtra, India",
  vnit: "Visvesvaraya National Institute of Technology, Nagpur, Maharashtra, India",
  "bits pilani": "Birla Institute of Technology and Science, Pilani, Rajasthan, India",
  bits: "Birla Institute of Technology and Science, Pilani, Rajasthan, India",
  
  });
  Object.assign(placeVariations, {
  // Educational Institutions - Telangana & Andhra Pradesh
  "iit hyderabad": "Indian Institute of Technology, Hyderabad, Telangana, India",
  iith: "Indian Institute of Technology, Hyderabad, Telangana, India",
  "nit warangal": "National Institute of Technology, Warangal, Telangana, India",
  nitw: "National Institute of Technology, Warangal, Telangana, India",
  "cbit hyderabad": "Chaitanya Bharathi Institute of Technology, Hyderabad, Telangana, India",
  cbit: "Chaitanya Bharathi Institute of Technology, Hyderabad, Telangana, India",
  "jntu hyderabad": "Jawaharlal Nehru Technological University, Hyderabad, Telangana, India",
  jntuh: "Jawaharlal Nehru Technological University, Hyderabad, Telangana, India",
  "iiit hyderabad": "International Institute of Information Technology, Hyderabad, Telangana, India",
  iiith: "International Institute of Information Technology, Hyderabad, Telangana, India",
  "ou hyderabad": "Osmania University, Hyderabad, Telangana, India",
  "osmania university": "Osmania University, Hyderabad, Telangana, India",
  "bits hyderabad": "Birla Institute of Technology and Science, Hyderabad, Telangana, India",
  "gitam visakhapatnam": "GITAM University, Visakhapatnam, Andhra Pradesh, India",
  gitam: "GITAM University, Visakhapatnam, Andhra Pradesh, India",
  
  });
  Object.assign(placeVariations, {
  // Educational Institutions - North India
  "iit delhi": "Indian Institute of Technology, Delhi, India",
  iitd: "Indian Institute of Technology, Delhi, India",
  "iit kanpur": "Indian Institute of Technology, Kanpur, Uttar Pradesh, India",
  iitk: "Indian Institute of Technology, Kanpur, Uttar Pradesh, India",
  "iit kharagpur": "Indian Institute of Technology, Kharagpur, West Bengal, India",
  iitkgp: "Indian Institute of Technology, Kharagpur, West Bengal, India",
  "iit roorkee": "Indian Institute of Technology, Roorkee, Uttarakhand, India",
  iitr: "Indian Institute of Technology, Roorkee, Uttarakhand, India",
  "iit guwahati": "Indian Institute of Technology, Guwahati, Assam, India",
  iitg: "Indian Institute of Technology, Guwahati, Assam, India",
  "iit bhu": "Indian Institute of Technology (BHU), Varanasi, Uttar Pradesh, India",
  "nit allahabad": "Motilal Nehru National Institute of Technology, Prayagraj, Uttar Pradesh, India",
  mnnit: "Motilal Nehru National Institute of Technology, Prayagraj, Uttar Pradesh, India",
  "dtu delhi": "Delhi Technological University, Delhi, India",
  dtu: "Delhi Technological University, Delhi, India",
  "nsit delhi": "Netaji Subhas University of Technology, Delhi, India",
  nsut: "Netaji Subhas University of Technology, Delhi, India",
  
  });
  Object.assign(placeVariations, {
  // Educational Institutions - Eastern India
  "bit mesra": "Birla Institute of Technology, Mesra, Jharkhand, India",
  "nit durgapur": "National Institute of Technology, Durgapur, West Bengal, India",
  nitd: "National Institute of Technology, Durgapur, West Bengal, India",
  "nit rourkela": "National Institute of Technology, Rourkela, Odisha, India",
  nitr: "National Institute of Technology, Rourkela, Odisha, India",
  "jadavpur university": "Jadavpur University, Kolkata, West Bengal, India",
  
  });
  Object.assign(placeVariations, {
  // Other Institutions
  "iisc bangalore": "Indian Institute of Science, Bangalore, Karnataka, India",
  iisc: "Indian Institute of Science, Bangalore, Karnataka, India",
  
  });
  Object.assign(placeVariations, {
  // Andhra Pradesh Cities
  warangal: "Warangal, Telangana, India",
  hyderabad: "Hyderabad, Telangana, India",
  visakhapatnam: "Visakhapatnam, Andhra Pradesh, India",
  guntur: "Guntur, Andhra Pradesh, India",
  nellore: "Nellore, Andhra Pradesh, India",
  kurnool: "Kurnool, Andhra Pradesh, India",
  rajahmundry: "Rajahmundry, Andhra Pradesh, India",
  rajamahendravaram: "Rajahmundry, Andhra Pradesh, India",
  kakinada: "Kakinada, Andhra Pradesh, India",
  tirupathi: "Tirupati, Andhra Pradesh, India",
  anantapur: "Anantapur, Andhra Pradesh, India",
  kadapa: "Kadapa, Andhra Pradesh, India",
  cuddapah: "Kadapa, Andhra Pradesh, India",
  chittoor: "Chittoor, Andhra Pradesh, India",
  ongole: "Ongole, Andhra Pradesh, India",
  eluru: "Eluru, Andhra Pradesh, India",
  vizianagaram: "Vizianagaram, Andhra Pradesh, India",
  srikakulam: "Srikakulam, Andhra Pradesh, India",
  machilipatnam: "Machilipatnam, Andhra Pradesh, India",
  tenali: "Tenali, Andhra Pradesh, India",
  proddatur: "Proddatur, Andhra Pradesh, India",
  
  });
  Object.assign(placeVariations, {
  // Telangana Cities
  nizamabad: "Nizamabad, Telangana, India",
  karimnagar: "Karimnagar, Telangana, India",
  khammam: "Khammam, Telangana, India",
  mahbubnagar: "Mahbubnagar, Telangana, India",
  rangareddy: "Rangareddy, Telangana, India",
  medak: "Medak, Telangana, India",
  nalgonda: "Nalgonda, Telangana, India",
  adilabad: "Adilabad, Telangana, India",
  sangareddy: "Sangareddy, Telangana, India",
  siddipet: "Siddipet, Telangana, India",
  mancherial: "Mancherial, Telangana, India",
  kamareddy: "Kamareddy, Telangana, India",
  
  });
  Object.assign(placeVariations, {
  // Tamil Nadu Cities
  chennai: "Chennai, Tamil Nadu, India",
  madras: "Chennai, Tamil Nadu, India",
  coimbatore: "Coimbatore, Tamil Nadu, India",
  salem: "Salem, Tamil Nadu, India",
  tiruchirappalli: "Tiruchirappalli, Tamil Nadu, India",
  trichy: "Tiruchirappalli, Tamil Nadu, India",
  tirunelveli: "Tirunelveli, Tamil Nadu, India",
  erode: "Erode, Tamil Nadu, India",
  vellore: "Vellore, Tamil Nadu, India",
  thoothukudi: "Thoothukudi, Tamil Nadu, India",
  dindigul: "Dindigul, Tamil Nadu, India",
  thanjavur: "Thanjavur, Tamil Nadu, India",
  nagercoil: "Nagercoil, Tamil Nadu, India",
  kumbakonam: "Kumbakonam, Tamil Nadu, India",
  karur: "Karur, Tamil Nadu, India",
  pudukkottai: "Pudukkottai, Tamil Nadu, India",
  ooty: "Ooty, Tamil Nadu, India",
  udhagamandalam: "Ooty, Tamil Nadu, India",
  kodaikanal: "Kodaikanal, Tamil Nadu, India",
  kanyakumari: "Kanyakumari, Tamil Nadu, India",
  "cape comorin": "Kanyakumari, Tamil Nadu, India",
  
  });
  Object.assign(placeVariations, {
  // Kerala Cities
  kochi: "Kochi, Kerala, India",
  cochin: "Kochi, Kerala, India",
  thiruvananthapuram: "Thiruvananthapuram, Kerala, India",
  trivandrum: "Thiruvananthapuram, Kerala, India",
  kozhikode: "Kozhikode, Kerala, India",
  calicut: "Kozhikode, Kerala, India",
  thrissur: "Thrissur, Kerala, India",
  kollam: "Kollam, Kerala, India",
  quilon: "Kollam, Kerala, India",
  palakkad: "Palakkad, Kerala, India",
  palghat: "Palakkad, Kerala, India",
  kannur: "Kannur, Kerala, India",
  cannanore: "Kannur, Kerala, India",
  alappuzha: "Alappuzha, Kerala, India",
  alleppey: "Alappuzha, Kerala, India",
  malappuram: "Malappuram, Kerala, India",
  kottayam: "Kottayam, Kerala, India",
  munnar: "Munnar, Kerala, India",
  wayanad: "Wayanad, Kerala, India",
  thekkady: "Thekkady, Kerala, India",
  varkala: "Varkala, Kerala, India",
  kovalam: "Kovalam, Kerala, India",
  
  });
  Object.assign(placeVariations, {
  // Karnataka Cities
  hubli: "Hubballi, Karnataka, India",
  hubballi: "Hubballi, Karnataka, India",
  dharwad: "Dharwad, Karnataka, India",
  mangalore: "Mangaluru, Karnataka, India",
  mangaluru: "Mangaluru, Karnataka, India",
  belgaum: "Belagavi, Karnataka, India",
  belagavi: "Belagavi, Karnataka, India",
  gulbarga: "Kalaburagi, Karnataka, India",
  kalaburagi: "Kalaburagi, Karnataka, India",
  davangere: "Davangere, Karnataka, India",
  bellary: "Ballari, Karnataka, India",
  ballari: "Ballari, Karnataka, India",
  bijapur: "Vijayapura, Karnataka, India",
  vijayapura: "Vijayapura, Karnataka, India",
  shimoga: "Shivamogga, Karnataka, India",
  shivamogga: "Shivamogga, Karnataka, India",
  tumkur: "Tumakuru, Karnataka, India",
  tumakuru: "Tumakuru, Karnataka, India",
  raichur: "Raichur, Karnataka, India",
  hassan: "Hassan, Karnataka, India",
  mandya: "Mandya, Karnataka, India",
  chitradurga: "Chitradurga, Karnataka, India",
  kolar: "Kolar, Karnataka, India",
  chikmagalur: "Chikkamagaluru, Karnataka, India",
  chikkamagaluru: "Chikkamagaluru, Karnataka, India",
  coorg: "Kodagu, Karnataka, India",
  kodagu: "Kodagu, Karnataka, India",
  madikeri: "Madikeri, Karnataka, India",
  manipal: "Manipal, Karnataka, India",
  karwar: "Karwar, Karnataka, India",
  
  });
  Object.assign(placeVariations, {
  // Maharashtra Cities
  mumbai: "Mumbai, Maharashtra, India",
  bombay: "Mumbai, Maharashtra, India",
  pune: "Pune, Maharashtra, India",
  nagpur: "Nagpur, Maharashtra, India",
  aurangabad: "Aurangabad, Maharashtra, India",
  solapur: "Solapur, Maharashtra, India",
  kolhapur: "Kolhapur, Maharashtra, India",
  thane: "Thane, Maharashtra, India",
  sangli: "Sangli, Maharashtra, India",
  amravati: "Amravati, Maharashtra, India",
  nanded: "Nanded, Maharashtra, India",
  ahmednagar: "Ahmednagar, Maharashtra, India",
  akola: "Akola, Maharashtra, India",
  latur: "Latur, Maharashtra, India",
  jalgaon: "Jalgaon, Maharashtra, India",
  dhule: "Dhule, Maharashtra, India",
  mahabaleshwar: "Mahabaleshwar, Maharashtra, India",
  lonavala: "Lonavala, Maharashtra, India",
  matheran: "Matheran, Maharashtra, India",
  alibag: "Alibaug, Maharashtra, India",
  alibaug: "Alibaug, Maharashtra, India",
  
  });
  Object.assign(placeVariations, {
  // Gujarat Cities
  ahmedabad: "Ahmedabad, Gujarat, India",
  surat: "Surat, Gujarat, India",
  vadodara: "Vadodara, Gujarat, India",
  baroda: "Vadodara, Gujarat, India",
  rajkot: "Rajkot, Gujarat, India",
  bhavnagar: "Bhavnagar, Gujarat, India",
  jamnagar: "Jamnagar, Gujarat, India",
  junagadh: "Junagadh, Gujarat, India",
  gandhinagar: "Gandhinagar, Gujarat, India",
  anand: "Anand, Gujarat, India",
  nadiad: "Nadiad, Gujarat, India",
  morbi: "Morbi, Gujarat, India",
  surendranagar: "Surendranagar, Gujarat, India",
  bharuch: "Bharuch, Gujarat, India",
  valsad: "Valsad, Gujarat, India",
  vapi: "Vapi, Gujarat, India",
  kutch: "Kutch, Gujarat, India",
  diu: "Diu, Daman and Diu, India",
  daman: "Daman, Daman and Diu, India",
  
  });
  Object.assign(placeVariations, {
  // Rajasthan Cities
  jaipur: "Jaipur, Rajasthan, India",
  jodhpur: "Jodhpur, Rajasthan, India",
  udaipur: "Udaipur, Rajasthan, India",
  kota: "Kota, Rajasthan, India",
  bikaner: "Bikaner, Rajasthan, India",
  ajmer: "Ajmer, Rajasthan, India",
  alwar: "Alwar, Rajasthan, India",
  bharatpur: "Bharatpur, Rajasthan, India",
  jaisalmer: "Jaisalmer, Rajasthan, India",
  sikar: "Sikar, Rajasthan, India",
  pali: "Pali, Rajasthan, India",
  tonk: "Tonk, Rajasthan, India",
  "mount abu": "Mount Abu, Rajasthan, India",
  chittorgarh: "Chittorgarh, Rajasthan, India",
  
  });
  Object.assign(placeVariations, {
  // Uttar Pradesh Cities
  lucknow: "Lucknow, Uttar Pradesh, India",
  kanpur: "Kanpur, Uttar Pradesh, India",
  ghaziabad: "Ghaziabad, Uttar Pradesh, India",
  agra: "Agra, Uttar Pradesh, India",
  meerut: "Meerut, Uttar Pradesh, India",
  allahabad: "Prayagraj, Uttar Pradesh, India",
  prayagraj: "Prayagraj, Uttar Pradesh, India",
  bareilly: "Bareilly, Uttar Pradesh, India",
  aligarh: "Aligarh, Uttar Pradesh, India",
  moradabad: "Moradabad, Uttar Pradesh, India",
  saharanpur: "Saharanpur, Uttar Pradesh, India",
  gorakhpur: "Gorakhpur, Uttar Pradesh, India",
  noida: "Noida, Uttar Pradesh, India",
  firozabad: "Firozabad, Uttar Pradesh, India",
  jhansi: "Jhansi, Uttar Pradesh, India",
  muzaffarnagar: "Muzaffarnagar, Uttar Pradesh, India",
  bulandshahr: "Bulandshahr, Uttar Pradesh, India",
  rampur: "Rampur, Uttar Pradesh, India",
  shahjahanpur: "Shahjahanpur, Uttar Pradesh, India",
  farrukhabad: "Farrukhabad, Uttar Pradesh, India",
  nainital: "Nainital, Uttarakhand, India",
  mussoorie: "Mussoorie, Uttarakhand, India",
  dehradun: "Dehradun, Uttarakhand, India",
  
  });
  Object.assign(placeVariations, {
  // Madhya Pradesh Cities
  indore: "Indore, Madhya Pradesh, India",
  bhopal: "Bhopal, Madhya Pradesh, India",
  jabalpur: "Jabalpur, Madhya Pradesh, India",
  gwalior: "Gwalior, Madhya Pradesh, India",
  sagar: "Sagar, Madhya Pradesh, India",
  ratlam: "Ratlam, Madhya Pradesh, India",
  rewa: "Rewa, Madhya Pradesh, India",
  satna: "Satna, Madhya Pradesh, India",
  murwara: "Katni, Madhya Pradesh, India",
  katni: "Katni, Madhya Pradesh, India",
  singrauli: "Singrauli, Madhya Pradesh, India",
  burhanpur: "Burhanpur, Madhya Pradesh, India",
  khandwa: "Khandwa, Madhya Pradesh, India",
  pachmarhi: "Pachmarhi, Madhya Pradesh, India",
  sanchi: "Sanchi, Madhya Pradesh, India",
  
  });
  Object.assign(placeVariations, {
  // West Bengal Cities
  kolkata: "Kolkata, West Bengal, India",
  calcutta: "Kolkata, West Bengal, India",
  howrah: "Howrah, West Bengal, India",
  durgapur: "Durgapur, West Bengal, India",
  asansol: "Asansol, West Bengal, India",
  siliguri: "Siliguri, West Bengal, India",
  bardhaman: "Bardhaman, West Bengal, India",
  barddhaman: "Bardhaman, West Bengal, India",
  malda: "Malda, West Bengal, India",
  baharampur: "Baharampur, West Bengal, India",
  habra: "Habra, West Bengal, India",
  kharagpur: "Kharagpur, West Bengal, India",
  shantiniketan: "Shantiniketan, West Bengal, India",
  darjeeling: "Darjeeling, West Bengal, India",
  kalimpong: "Kalimpong, West Bengal, India",
  digha: "Digha, West Bengal, India",
  mandarmani: "Mandarmani, West Bengal, India",
  
  });
  Object.assign(placeVariations, {
  // Bihar Cities
  patna: "Patna, Bihar, India",
  bhagalpur: "Bhagalpur, Bihar, India",
  muzaffarpur: "Muzaffarpur, Bihar, India",
  purnia: "Purnia, Bihar, India",
  darbhanga: "Darbhanga, Bihar, India",
  bihar_sharif: "Bihar Sharif, Bihar, India",
  "bihar sharif": "Bihar Sharif, Bihar, India",
  arrah: "Arrah, Bihar, India",
  begusarai: "Begusarai, Bihar, India",
  katihar: "Katihar, Bihar, India",
  munger: "Munger, Bihar, India",
  chhapra: "Chhapra, Bihar, India",
  sasaram: "Sasaram, Bihar, India",
  hajipur: "Hajipur, Bihar, India",
  dehri: "Dehri, Bihar, India",
  
  });
  Object.assign(placeVariations, {
  // Jharkhand Cities
  ranchi: "Ranchi, Jharkhand, India",
  jamshedpur: "Jamshedpur, Jharkhand, India",
  dhanbad: "Dhanbad, Jharkhand, India",
  bokaro: "Bokaro Steel City, Jharkhand, India",
  "bokaro steel city": "Bokaro Steel City, Jharkhand, India",
  deoghar: "Deoghar, Jharkhand, India",
  phusro: "Phusro, Jharkhand, India",
  hazaribagh: "Hazaribagh, Jharkhand, India",
  giridih: "Giridih, Jharkhand, India",
  ramgarh: "Ramgarh, Jharkhand, India",
  medininagar: "Medininagar, Jharkhand, India",
  chirkunda: "Chirkunda, Jharkhand, India",
  
  });
  Object.assign(placeVariations, {
  // Odisha Cities
  bhubaneswar: "Bhubaneswar, Odisha, India",
  cuttack: "Cuttack, Odisha, India",
  rourkela: "Rourkela, Odisha, India",
  brahmapur: "Brahmapur, Odisha, India",
  berhampur: "Brahmapur, Odisha, India",
  sambalpur: "Sambalpur, Odisha, India",
  balasore: "Balasore, Odisha, India",
  bhadrak: "Bhadrak, Odisha, India",
  baripada: "Baripada, Odisha, India",
  konark: "Konark, Odisha, India",
  chilika: "Chilika Lake, Odisha, India",
  "chilika lake": "Chilika Lake, Odisha, India",
  
  });
  Object.assign(placeVariations, {
  // Chhattisgarh Cities
  raipur: "Raipur, Chhattisgarh, India",
  bhilai: "Bhilai, Chhattisgarh, India",
  bilaspur: "Bilaspur, Chhattisgarh, India",
  korba: "Korba, Chhattisgarh, India",
  durg: "Durg, Chhattisgarh, India",
  rajnandgaon: "Rajnandgaon, Chhattisgarh, India",
  raigarh: "Raigarh, Chhattisgarh, India",
  jagdalpur: "Jagdalpur, Chhattisgarh, India",
  ambikapur: "Ambikapur, Chhattisgarh, India",
  
  });
  Object.assign(placeVariations, {
  // Punjab Cities
  ludhiana: "Ludhiana, Punjab, India",
  jalandhar: "Jalandhar, Punjab, India",
  patiala: "Patiala, Punjab, India",
  bathinda: "Bathinda, Punjab, India",
  mohali: "Mohali, Punjab, India",
  "sahibzada ajit singh nagar": "Mohali, Punjab, India",
  hoshiarpur: "Hoshiarpur, Punjab, India",
  batala: "Batala, Punjab, India",
  pathankot: "Pathankot, Punjab, India",
  moga: "Moga, Punjab, India",
  abohar: "Abohar, Punjab, India",
  malerkotla: "Malerkotla, Punjab, India",
  khanna: "Khanna, Punjab, India",
  phagwara: "Phagwara, Punjab, India",
  muktsar: "Muktsar, Punjab, India",
  barnala: "Barnala, Punjab, India",
  firozpur: "Firozpur, Punjab, India",
  kapurthala: "Kapurthala, Punjab, India",
  faridkot: "Faridkot, Punjab, India",
  
  });
  Object.assign(placeVariations, {
  // Haryana Cities
  faridabad: "Faridabad, Haryana, India",
  gurugram: "Gurugram, Haryana, India",
  gurgaon: "Gurugram, Haryana, India",
  panipat: "Panipat, Haryana, India",
  ambala: "Ambala, Haryana, India",
  yamunanagar: "Yamunanagar, Haryana, India",
  rohtak: "Rohtak, Haryana, India",
  hisar: "Hisar, Haryana, India",
  karnal: "Karnal, Haryana, India",
  sonipat: "Sonipat, Haryana, India",
  panchkula: "Panchkula, Haryana, India",
  bhiwani: "Bhiwani, Haryana, India",
  sirsa: "Sirsa, Haryana, India",
  bahadurgarh: "Bahadurgarh, Haryana, India",
  jind: "Jind, Haryana, India",
  thanesar: "Thanesar, Haryana, India",
  kaithal: "Kaithal, Haryana, India",
  rewari: "Rewari, Haryana, India",
  palwal: "Palwal, Haryana, India",
  
  });
  Object.assign(placeVariations, {
  // Himachal Pradesh Cities
  shimla: "Shimla, Himachal Pradesh, India",
  simla: "Shimla, Himachal Pradesh, India",
  manali: "Manali, Himachal Pradesh, India",
  dharamshala: "Dharamshala, Himachal Pradesh, India",
  dharamsala: "Dharamshala, Himachal Pradesh, India",
  kullu: "Kullu, Himachal Pradesh, India",
  solan: "Solan, Himachal Pradesh, India",
  mandi: "Mandi, Himachal Pradesh, India",
  palampur: "Palampur, Himachal Pradesh, India",
  una: "Una, Himachal Pradesh, India",
  nahan: "Nahan, Himachal Pradesh, India",
  hamirpur: "Hamirpur, Himachal Pradesh, India",
  chamba: "Chamba, Himachal Pradesh, India",
  dalhousie: "Dalhousie, Himachal Pradesh, India",
  kasauli: "Kasauli, Himachal Pradesh, India",
  kangra: "Kangra, Himachal Pradesh, India",
  kinnaur: "Kinnaur, Himachal Pradesh, India",
  spiti: "Spiti Valley, Himachal Pradesh, India",
  "spiti valley": "Spiti Valley, Himachal Pradesh, India",
  mcleodganj: "McLeod Ganj, Himachal Pradesh, India",
  "mcleod ganj": "McLeod Ganj, Himachal Pradesh, India",
  
  });
  Object.assign(placeVariations, {
  // Uttarakhand Cities
  roorkee: "Roorkee, Uttarakhand, India",
  haldwani: "Haldwani, Uttarakhand, India",
  rudrapur: "Rudrapur, Uttarakhand, India",
  kashipur: "Kashipur, Uttarakhand, India",
  almora: "Almora, Uttarakhand, India",
  pithoragarh: "Pithoragarh, Uttarakhand, India",
  tehri: "Tehri, Uttarakhand, India",
  pauri: "Pauri, Uttarakhand, India",
  chamoli: "Chamoli, Uttarakhand, India",
  uttarkashi: "Uttarkashi, Uttarakhand, India",
  ranikhet: "Ranikhet, Uttarakhand, India",
  auli: "Auli, Uttarakhand, India",
  "jim corbett": "Jim Corbett National Park, Uttarakhand, India",
  "corbett national park": "Jim Corbett National Park, Uttarakhand, India",
  
  });
  Object.assign(placeVariations, {
  // Assam Cities
  guwahati: "Guwahati, Assam, India",
  gauhati: "Guwahati, Assam, India",
  dibrugarh: "Dibrugarh, Assam, India",
  silchar: "Silchar, Assam, India",
  jorhat: "Jorhat, Assam, India",
  nagaon: "Nagaon, Assam, India",
  tinsukia: "Tinsukia, Assam, India",
  tezpur: "Tezpur, Assam, India",
  bongaigaon: "Bongaigaon, Assam, India",
  golaghat: "Golaghat, Assam, India",
  diphu: "Diphu, Assam, India",
  north_lakhimpur: "North Lakhimpur, Assam, India",
  "north lakhimpur": "North Lakhimpur, Assam, India",
  karimganj: "Karimganj, Assam, India",
  sivasagar: "Sivasagar, Assam, India",
  dhubri: "Dhubri, Assam, India",
  kaziranga: "Kaziranga National Park, Assam, India",
  "kaziranga national park": "Kaziranga National Park, Assam, India",
  manas: "Manas National Park, Assam, India",
  "manas national park": "Manas National Park, Assam, India",
  majuli: "Majuli, Assam, India",
  
  });
  Object.assign(placeVariations, {
  // Northeast States Cities
  imphal: "Imphal, Manipur, India",
  shillong: "Shillong, Meghalaya, India",
  agartala: "Agartala, Tripura, India",
  aizawl: "Aizawl, Mizoram, India",
  kohima: "Kohima, Nagaland, India",
  dimapur: "Dimapur, Nagaland, India",
  itanagar: "Itanagar, Arunachal Pradesh, India",
  gangtok: "Gangtok, Sikkim, India",
  namchi: "Namchi, Sikkim, India",
  pelling: "Pelling, Sikkim, India",
  lachung: "Lachung, Sikkim, India",
  cherrapunji: "Cherrapunji, Meghalaya, India",
  cherrapunjee: "Cherrapunji, Meghalaya, India",
  dawki: "Dawki, Meghalaya, India",
  tawang: "Tawang, Arunachal Pradesh, India",
  
  });
  Object.assign(placeVariations, {
  // Goa Cities & Beaches
  panaji: "Panaji, Goa, India",
  panjim: "Panaji, Goa, India",
  "vasco da gama": "Vasco da Gama, Goa, India",
  vasco: "Vasco da Gama, Goa, India",
  margao: "Margao, Goa, India",
  madgaon: "Margao, Goa, India",
  mapusa: "Mapusa, Goa, India",
  ponda: "Ponda, Goa, India",
  "old goa": "Old Goa, Goa, India",
  "calangute beach": "Calangute Beach, Goa, India",
  calangute: "Calangute, Goa, India",
  "baga beach": "Baga Beach, Goa, India",
  baga: "Baga, Goa, India",
  "anjuna beach": "Anjuna Beach, Goa, India",
  anjuna: "Anjuna, Goa, India",
  "vagator beach": "Vagator Beach, Goa, India",
  vagator: "Vagator, Goa, India",
  "candolim beach": "Candolim Beach, Goa, India",
  candolim: "Candolim, Goa, India",
  "colva beach": "Colva Beach, Goa, India",
  colva: "Colva, Goa, India",
  "palolem beach": "Palolem Beach, Goa, India",
  palolem: "Palolem, Goa, India",
  "arambol beach": "Arambol Beach, Goa, India",
  arambol: "Arambol, Goa, India",
  "morjim beach": "Morjim Beach, Goa, India",
  morjim: "Morjim, Goa, India",
  "agonda beach": "Agonda Beach, Goa, India",
  agonda: "Agonda, Goa, India",
  
  });
  Object.assign(placeVariations, {
  // Delhi Neighborhoods
  "new delhi": "New Delhi, Delhi, India",
  "connaught place": "Connaught Place, New Delhi, Delhi, India",
  "cp delhi": "Connaught Place, New Delhi, Delhi, India",
  "karol bagh": "Karol Bagh, Delhi, India",
  "chandni chowk": "Chandni Chowk, Delhi, India",
  "sarojini nagar": "Sarojini Nagar, New Delhi, Delhi, India",
  "lajpat nagar": "Lajpat Nagar, New Delhi, Delhi, India",
  "dwarka delhi": "Dwarka, New Delhi, Delhi, India",
  "rohini delhi": "Rohini, Delhi, India",
  "pitampura delhi": "Pitampura, Delhi, India",
  "janakpuri delhi": "Janakpuri, New Delhi, Delhi, India",
  "nehru place": "Nehru Place, New Delhi, Delhi, India",
  "vasant kunj": "Vasant Kunj, New Delhi, Delhi, India",
  "greater kailash": "Greater Kailash, New Delhi, Delhi, India",
  "hauz khas": "Hauz Khas, New Delhi, Delhi, India",
  "south delhi": "South Delhi, Delhi, India",
  "north delhi": "North Delhi, Delhi, India",
  "east delhi": "East Delhi, Delhi, India",
  "west delhi": "West Delhi, Delhi, India",
  
  });
  Object.assign(placeVariations, {
  // Union Territories
  puducherry: "Puducherry, India",
  pondicherry: "Puducherry, India",
  chandigarh: "Chandigarh, India",
  "daman and diu": "Daman and Diu, India",
  "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu, India",
  silvassa: "Silvassa, Dadra and Nagar Haveli, India",
  lakshadweep: "Lakshadweep, India",
  kavaratti: "Kavaratti, Lakshadweep, India",
  "andaman and nicobar": "Andaman and Nicobar Islands, India",
  "port blair": "Port Blair, Andaman and Nicobar Islands, India",
  "havelock island": "Havelock Island, Andaman and Nicobar Islands, India",
  havelock: "Havelock Island, Andaman and Nicobar Islands, India",
  "neil island": "Neil Island, Andaman and Nicobar Islands, India",
  ladakh: "Ladakh, India",
  leh: "Leh, Ladakh, India",
  kargil: "Kargil, Ladakh, India",
  "nubra valley": "Nubra Valley, Ladakh, India",
  "pangong lake": "Pangong Lake, Ladakh, India",
  pangong: "Pangong Lake, Ladakh, India",
  "jammu and kashmir": "Jammu and Kashmir, India",
  srinagar: "Srinagar, Jammu and Kashmir, India",
  jammu: "Jammu, Jammu and Kashmir, India",
  gulmarg: "Gulmarg, Jammu and Kashmir, India",
  pahalgam: "Pahalgam, Jammu and Kashmir, India",
  sonamarg: "Sonamarg, Jammu and Kashmir, India",
  
  });
  Object.assign(placeVariations, {
  // States - direct mapping
  goa: "Goa, India",
  kerala: "Kerala, India",
  karnataka: "Karnataka, India",
  "tamil nadu": "Tamil Nadu, India",
  "andhra pradesh": "Andhra Pradesh, India",
  telangana: "Telangana, India",
  maharashtra: "Maharashtra, India",
  gujarat: "Gujarat, India",
  rajasthan: "Rajasthan, India",
  "uttar pradesh": "Uttar Pradesh, India",
  "madhya pradesh": "Madhya Pradesh, India",
  bihar: "Bihar, India",
  "west bengal": "West Bengal, India",
  odisha: "Odisha, India",
  jharkhand: "Jharkhand, India",
  chhattisgarh: "Chhattisgarh, India",
  punjab: "Punjab, India",
  haryana: "Haryana, India",
  himachal: "Himachal Pradesh, India",
  "himachal pradesh": "Himachal Pradesh, India",
  uttarakhand: "Uttarakhand, India",
  assam: "Assam, India",
  manipur: "Manipur, India",
  meghalaya: "Meghalaya, India",
  tripura: "Tripura, India",
  mizoram: "Mizoram, India",
  nagaland: "Nagaland, India",
  arunachal: "Arunachal Pradesh, India",
  "arunachal pradesh": "Arunachal Pradesh, India",
  sikkim: "Sikkim, India",
  
  });
  Object.assign(placeVariations, {
  // Famous Tourist Destinations & Hill Stations
  "valley of flowers": "Valley of Flowers National Park, Uttarakhand, India",
  "hemkund sahib": "Hemkund Sahib, Uttarakhand, India",
  "yamunotri": "Yamunotri, Uttarakhand, India",
  "gangotri": "Gangotri, Uttarakhand, India",
  "char dham": "Char Dham, Uttarakhand, India",
  "amarnath cave": "Amarnath Cave, Jammu and Kashmir, India",
  "amarnath": "Amarnath Cave, Jammu and Kashmir, India",
  "vaishno devi": "Vaishno Devi, Jammu and Kashmir, India",
  "rann of kutch": "Rann of Kutch, Gujarat, India",
  "kutch": "Kutch, Gujarat, India",
  "statue of unity": "Statue of Unity, Gujarat, India",
  "sundarban": "Sundarbans, West Bengal, India",
  "sundarbans": "Sundarbans, West Bengal, India",
  "andaman": "Andaman and Nicobar Islands, India",
  "nicobar": "Andaman and Nicobar Islands, India",
  "taj mahal": "Taj Mahal, Agra, Uttar Pradesh, India",
  "agra": "Agra, Uttar Pradesh, India",
  "fatehpur": "Fatehpur Sikri, Uttar Pradesh, India",
  "fatehpur sikri": "Fatehpur Sikri, Uttar Pradesh, India",
  "red fort": "Red Fort, Delhi, India",
  "qutub minar": "Qutub Minar, Delhi, India",
  "india gate": "India Gate, New Delhi, Delhi, India",
  "lotus temple": "Lotus Temple, New Delhi, Delhi, India",
  "akshardham delhi": "Akshardham Temple, Delhi, India",
  "jaipur city palace": "City Palace, Jaipur, Rajasthan, India",
  "hawa mahal": "Hawa Mahal, Jaipur, Rajasthan, India",
  "amber fort": "Amber Fort, Jaipur, Rajasthan, India",
  "mehrangarh fort": "Mehrangarh Fort, Jodhpur, Rajasthan, India",
  "city palace udaipur": "City Palace, Udaipur, Rajasthan, India",
  "lake pichola": "Lake Pichola, Udaipur, Rajasthan, India",
  "gateway of india": "Gateway of India, Mumbai, Maharashtra, India",
  "marine drive": "Marine Drive, Mumbai, Maharashtra, India",
  "elephanta caves": "Elephanta Caves, Mumbai, Maharashtra, India",
  "victoria terminus": "Chhatrapati Shivaji Terminus, Mumbai, Maharashtra, India",
  cst: "Chhatrapati Shivaji Terminus, Mumbai, Maharashtra, India",
  "aga khan palace": "Aga Khan Palace, Pune, Maharashtra, India",
  "shaniwar wada": "Shaniwar Wada, Pune, Maharashtra, India",
  "mysore palace": "Mysore Palace, Mysuru, Karnataka, India",
  "brindavan gardens": "Brindavan Gardens, Mysuru, Karnataka, India",
  "tipu sultan palace": "Tipu Sultan's Summer Palace, Bengaluru, Karnataka, India",
  "lalbagh": "Lalbagh Botanical Garden, Bengaluru, Karnataka, India",
  "cubbon park": "Cubbon Park, Bengaluru, Karnataka, India",
  "meenakshi temple": "Meenakshi Temple, Madurai, Tamil Nadu, India",
  "brihadeeswarar temple": "Brihadeeswarar Temple, Thanjavur, Tamil Nadu, India",
  "shore temple": "Shore Temple, Mahabalipuram, Tamil Nadu, India",
  "mahabalipuram": "Mahabalipuram, Tamil Nadu, India",
  "mamallapuram": "Mahabalipuram, Tamil Nadu, India",
  "backwaters": "Kerala Backwaters, Kerala, India",
  "kerala backwaters": "Kerala Backwaters, Kerala, India",
  "alleppey backwaters": "Alleppey Backwaters, Kerala, India",
  "kumarakom": "Kumarakom, Kerala, India",
  "periyar": "Periyar National Park, Kerala, India",
  "periyar national park": "Periyar National Park, Kerala, India",
  "silent valley": "Silent Valley National Park, Kerala, India",
  "eravikulam": "Eravikulam National Park, Kerala, India",
  "bandipur": "Bandipur National Park, Karnataka, India",
  "nagarhole": "Nagarhole National Park, Karnataka, India",
  "bandhavgarh": "Bandhavgarh National Park, Madhya Pradesh, India",
  "kanha": "Kanha National Park, Madhya Pradesh, India",
  "pench": "Pench National Park, Madhya Pradesh, India",
  "ranthambore": "Ranthambore National Park, Rajasthan, India",
  "sariska": "Sariska Tiger Reserve, Rajasthan, India",
  "gir": "Gir National Park, Gujarat, India",
  "gir forest": "Gir National Park, Gujarat, India",
  
  });
  Object.assign(placeVariations, {
  // Common abbreviations and alternative spellings
  ap: "Andhra Pradesh, India",
  tn: "Tamil Nadu, India",
  kl: "Kerala, India",
  ka: "Karnataka, India",
  ts: "Telangana, India",
  mh: "Maharashtra, India",
  gj: "Gujarat, India",
  rj: "Rajasthan, India",
  up: "Uttar Pradesh, India",
  mp: "Madhya Pradesh, India",
  wb: "West Bengal, India",
  br: "Bihar, India",
  or: "Odisha, India",
  jh: "Jharkhand, India",
  cg: "Chhattisgarh, India",
  pb: "Punjab, India",
  hr: "Haryana, India",
  hp: "Himachal Pradesh, India",
  uk: "Uttarakhand, India",
  as: "Assam, India",
  dl: "Delhi, India",
});

    let geoData = null

    const getSearchQueries = (place: string): string[] => {
      const normalizedInput = place.trim().toLowerCase().replace(/\s+/g, " ")

      // Check for partial matches in place variations
      for (const [key, value] of Object.entries(placeVariations)) {
        const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, " ")
        if (normalizedKey.startsWith(normalizedInput) && normalizedInput.length >= 3) {
          console.log(`Partial match found: "${normalizedInput}" -> "${normalizedKey}" -> "${value}"`)
          return [value]
        }
      }

      // If we have a specific variation, use it first
      if (placeVariations[normalizedInput]) {
        return [placeVariations[normalizedInput]]
      }

      // Detect if it's likely a state/UT/country by checking common patterns
      const isLikelyState = place.length > 3 && !place.includes(" district") && !place.includes(" taluk")

      const queries: string[] = []

      // Strategy 1: Try as exact administrative unit
      if (isLikelyState) {
        queries.push(`${place}, India`) // State/UT level
      }

      // Strategy 2: Try as major city/district
      queries.push(`${place} district, India`)
      queries.push(`${place} city, India`)

      // Strategy 3: Try with major South Indian states (common tourist regions)
      const majorStates = ["Karnataka", "Andhra Pradesh", "Tamil Nadu", "Kerala", "Telangana", "Goa"]
      majorStates.forEach((state) => {
        queries.push(`${place}, ${state}, India`)
      })

      // Strategy 4: Try as taluk/subdivision
      queries.push(`${place} taluk, Karnataka, India`)
      queries.push(`${place} taluk, Andhra Pradesh, India`)
      queries.push(`${place} taluk, Tamil Nadu, India`)

      // Strategy 5: Try with administrative suffixes
      queries.push(`${place} town, India`)
      queries.push(`${place} village, India`)
      queries.push(`${place} mandal, India`)

      // Strategy 6: Try with North Indian states for comprehensive coverage
      const northStates = ["Maharashtra", "Gujarat", "Rajasthan", "Uttar Pradesh", "Madhya Pradesh", "Delhi"]
      northStates.forEach((state) => {
        queries.push(`${place}, ${state}, India`)
      })

      // Strategy 7: Original query as fallback
      queries.push(place)

      return queries
    }

    const searchQueries = getSearchQueries(normalizedPlaceName)
    if (!API_KEY) {
      return NextResponse.json({ error: "server api key missing" }, { status: 500 })
    }

    for (const query of searchQueries) {
      const geoUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&bias=countrycode:in&filter=countrycode:in&limit=10&apiKey=${API_KEY}`
      console.log("Trying geocoding with query:", query)

      const geoResponse = await fetch(geoUrl)
      console.log("Geocoding response status:", geoResponse.status)

      if (geoResponse.ok) {
        const data = await geoResponse.json()
        if (data.features && data.features.length > 0) {
          for (const feature of data.features) {
            const { lat, lon } = feature.properties
            const placeType = feature.properties.place_type || ""
            const state = feature.properties.state || ""
            const country = feature.properties.country || ""

            if (lat >= 6 && lat <= 37 && lon >= 68 && lon <= 97 && country.toLowerCase().includes("india")) {
              const isHighPriority =
                placeType.includes("state") ||
                placeType.includes("city") ||
                placeType.includes("town") ||
                placeType.includes("district") ||
                query.includes(", India") // Direct state/UT queries

              const isMediumPriority =
                placeType.includes("village") ||
                placeType.includes("locality") ||
                state.toLowerCase().includes("andhra") ||
                state.toLowerCase().includes("karnataka") ||
                state.toLowerCase().includes("tamil") ||
                state.toLowerCase().includes("kerala") ||
                state.toLowerCase().includes("telangana") ||
                state.toLowerCase().includes("goa")

              geoData = { features: [feature] }
              console.log("Geocoding successful with query:", query)
              console.log("Verified Indian location:", { lat, lon, state, placeType, country })

              // Break early for high priority matches (states, major cities)
              if (isHighPriority) {
                console.log("High priority match found, using this location")
                break
              }

              // Continue searching for better matches if only medium priority
              if (isMediumPriority) {
                console.log("Medium priority match found, continuing search for better match")
                // Don't break, continue searching
              }
            } else {
              console.log("Location outside India or invalid country, trying next:", { lat, lon, country })
            }
          }

          // If we found a high priority match, stop searching
          if (geoData && searchQueries.indexOf(query) < 5) {
            // First 5 queries are high priority
            break
          }
        }
      }
    }

    if (!geoData || !geoData.features || geoData.features.length === 0) {
      return NextResponse.json(
        {
          error: "Location not found",
          message: `Could not find location "${normalizedPlaceName}" in India. Please try with a more specific location name or include district/state.`,
        },
        { status: 404 },
      )
    }

    const { lat, lon } = geoData.features[0].properties
    console.log("Coordinates found:", { lat, lon })

    const radius = 20000 // 20km radius
    const cacheKey = `${lat.toFixed(3)}|${lon.toFixed(3)}|${radius}|${normalizedPlaceName}`
    const now = Date.now()
    const cached = cache.get(cacheKey)
    if (cached && now - cached.ts < TTL_MS) {
      const payload = cached.data
      return NextResponse.json(payload)
    }
    const placesUrl = `https://api.geoapify.com/v2/places?categories=tourism.attraction,tourism.sights,entertainment.museum,entertainment.culture,entertainment.zoo,entertainment.aquarium,natural,heritage&filter=circle:${lon},${lat},${radius}&limit=20&apiKey=${API_KEY}`
    console.log("Places URL:", placesUrl)

    const placesResponse = await fetch(placesUrl)
    console.log("Places response status:", placesResponse.status)

    if (!placesResponse.ok) {
      const errorText = await placesResponse.text()
      console.log("Places error response:", errorText)
      throw new Error(`Failed to fetch tourist places: ${placesResponse.status} - ${errorText}`)
    }

    const placesData = await placesResponse.json()
    console.log("Places data received, features count:", placesData.features?.length || 0)

    // Check if we have famous places for this location
    const searchKey = normalizedPlaceName.replace(/\s+/g, "").toLowerCase()
    const famousPlacesForLocation = FAMOUS_PLACES[searchKey] || []

    const places =
      placesData.features
        ?.map((place: GeoapifyPlace) => {
          let placeName = place.properties.name || ""

          if (!placeName || placeName === "Unnamed Place") {
            // Check raw data for alternative names
            const rawData = place.properties.datasource?.raw
            if (rawData) {
              placeName = rawData.name || rawData.alt_name || rawData.official_name || rawData.loc_name || ""
            }

            if (!placeName) {
              // Try different address fields in order of preference
              const addressSources = [
                place.properties.formatted,
                place.properties.address_line1,
                place.properties.address_line2,
                place.properties.city,
              ].filter(Boolean)

              for (const address of addressSources) {
                if (address && address.trim()) {
                  // Extract the first meaningful part before comma, semicolon, or dash
                  const firstPart = address.split(/[,;-]/)[0].trim()
                  // Only use if meaningful (not just numbers, coordinates, or very short)
                  if (
                    firstPart &&
                    firstPart.length > 2 &&
                    !/^\d+$/.test(firstPart) &&
                    !/^\d+\.\d+$/.test(firstPart) && // Not coordinates
                    !firstPart.match(/^[A-Z]{1,3}\s*\d+/) && // Not road codes like "NH 44"
                    firstPart.length < 50
                  ) {
                    // Not too long
                    placeName = firstPart
                    console.log(`Extracted name from address: "${firstPart}" from "${address}"`)
                    break
                  }
                }
              }
            }

            // If still no name, create a simple descriptive name based on category
            if (!placeName) {
              const categories = place.properties.categories || []
              const primaryCategory = categories[0] || ""

              if (primaryCategory.includes("tourism.attraction")) {
                placeName = "Tourist Attraction"
              } else if (primaryCategory.includes("tourism.sights")) {
                placeName = "Tourist Sight"
              } else if (primaryCategory.includes("entertainment.museum")) {
                placeName = "Museum"
              } else if (primaryCategory.includes("natural.water")) {
                placeName = "Water Feature"
              } else if (primaryCategory.includes("natural")) {
                placeName = "Natural Area"
              } else if (primaryCategory.includes("heritage")) {
                placeName = "Heritage Site"
              } else {
                placeName = "Point of Interest"
              }
            }
          }

          // Calculate priority score
          let priority = 50 // Base priority

          // Check if this is a famous place for the location
          const famousPlace = famousPlacesForLocation.find(fp => 
            placeName.toLowerCase().includes(fp.name.toLowerCase()) ||
            fp.name.toLowerCase().includes(placeName.toLowerCase())
          )
          
          if (famousPlace) {
            priority = famousPlace.priority
            // Update categories if we have better ones from famous places
            if (famousPlace.categories.length > 0) {
              place.properties.categories = [...new Set([...famousPlace.categories, ...place.properties.categories])]
            }
          } else {
            // Boost priority based on category importance
            const categories = place.properties.categories || []
            if (categories.includes("tourism.attraction")) priority += 20
            if (categories.includes("tourism.sights")) priority += 15
            if (categories.includes("entertainment.museum")) priority += 10
            if (categories.includes("natural")) priority += 8
            if (categories.includes("heritage")) priority += 12
            if (categories.includes("religion.place_of_worship")) priority += 5
            
            // Boost priority for places with proper names
            if (placeName && placeName !== "Tourist Attraction" && placeName !== "Point of Interest") {
              priority += 10
            }
          }

          return {
            name: placeName,
            categories: place.properties.categories || [],
            address:
              place.properties.formatted ||
              place.properties.address_line1 ||
              `${place.properties.city || ""}, ${place.properties.country || ""}`.trim().replace(/^,\s*/, ""),
            lat: place.properties.lat,
            lon: place.properties.lon,
            priority: priority
          }
        })
        .filter((place: ProcessedPlace) => place.name && place.name.trim().length > 0)
        .sort((a: ProcessedPlace, b: ProcessedPlace) => b.priority - a.priority) || []

    console.log("Returning", places.length, "places")
    console.log("Sample place data:", places[0])
    const payload = {
      success: true,
      location: { lat, lon, name: normalizedPlaceName },
      places: places,
    }
    cache.set(cacheKey, { data: payload, ts: now })
    return NextResponse.json(payload)
  } catch (error) {
    console.error("Error in API route:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch tourist places",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const placeFromQuery = searchParams.get("place") || searchParams.get("q") || ""
  if (!placeFromQuery) {
    return NextResponse.json({ error: "Place name is required" }, { status: 400 })
  }
  // Reuse POST logic by crafting a Request-like body
  const proxyRequest = new Request(request.url, {
    method: "POST",
    body: JSON.stringify({ placeName: placeFromQuery }),
  }) as unknown as NextRequest
  return POST(proxyRequest)
}
