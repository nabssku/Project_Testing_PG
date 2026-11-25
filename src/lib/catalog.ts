export interface DemoProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  accent: string;
  icon: "coffee" | "cup" | "bag" | "lamp" | "headphones" | "book";
}

export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    id: "kopi-gayo",
    name: "Kopi Arabika Gayo 250g",
    category: "Kopi & Minuman",
    description: "Biji kopi panggang medium dari dataran tinggi Aceh, aroma cokelat & karamel.",
    price: 45000,
    accent: "bg-amber-50 text-amber-700 border-amber-200/70",
    icon: "coffee",
  },
  {
    id: "tumbler-matte",
    name: "Tumbler Stainless 500ml",
    category: "Gaya Hidup",
    description: "Menjaga minuman tetap dingin hingga 18 jam atau hangat hingga 10 jam.",
    price: 125000,
    accent: "bg-sky-50 text-sky-700 border-sky-200/70",
    icon: "cup",
  },
  {
    id: "totebag-kanvas",
    name: "Tote Bag Kanvas Tebal",
    category: "Fashion",
    description: "Kanvas katun 14oz dengan saku laptop 14 inci dan ritsleting utama.",
    price: 85000,
    accent: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
    icon: "bag",
  },
  {
    id: "lampu-meja",
    name: "Lampu Meja LED Minimalis",
    category: "Ruang Kerja",
    description: "3 tingkat kecerahan sentuh, cahaya hangat nyaman untuk bekerja malam.",
    price: 185000,
    accent: "bg-orange-50 text-orange-700 border-orange-200/70",
    icon: "lamp",
  },
  {
    id: "headphone-wireless",
    name: "Headphone Wireless Studio",
    category: "Elektronik",
    description: "Audio jernih dengan peredam bising aktif dan baterai tahan 30 jam.",
    price: 350000,
    accent: "bg-indigo-50 text-indigo-700 border-indigo-200/70",
    icon: "headphones",
  },
  {
    id: "notebook-a5",
    name: "Notebook Kulit A5 Dotted",
    category: "Alat Tulis",
    description: "Kertas 100gsm anti tembus tinta, cocok untuk catatan harian & sketsa.",
    price: 65000,
    accent: "bg-rose-50 text-rose-700 border-rose-200/70",
    icon: "book",
  },
];
