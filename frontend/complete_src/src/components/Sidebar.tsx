"use client";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart2, Zap, Building2, ShoppingCart, Package,
  Truck, Plane, PieChart, DollarSign, Landmark,
} from "lucide-react";

const NAV = [
  { href: "/",              label: "Dashboard",          icon: BarChart2  },
  { href: "/fintech",       label: "Fintech",            icon: Zap        },
  { href: "/banks",         label: "Banks",              icon: Building2  },
  { href: "/ecommerce",     label: "E-commerce",         icon: ShoppingCart },
  { href: "/import-export", label: "Import / Export",    icon: Package    },
  { href: "/logistics",     label: "Logistics",          icon: Truck      },
  { href: "/travel",        label: "Travel / Airlines",  icon: Plane      },
  { href: "/asset-mgmt",    label: "Asset Management",   icon: PieChart   },
  { href: "/treasury",      label: "Corp. Treasury",     icon: DollarSign },
  { href: "/government",    label: "Government & Policy",icon: Landmark   },
];

export default function Sidebar({ open }: { open: boolean }) {
  const pathname = usePathname();
  const router   = useRouter();

  return (
    <aside
      className={`${open ? "w-52" : "w-0 lg:w-14"} flex-shrink-0 bg-[#080f1e] border-r border-[#1a2744] overflow-hidden transition-all duration-300 flex flex-col`}
    >
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                active
                  ? "bg-[#1a2744] text-white"
                  : "text-[#4a6fa5] hover:bg-[#0d1525] hover:text-[#94a3b8]"
              }`}
            >
              <Icon size={13} className={active ? "text-[#60a5fa]" : "text-current flex-shrink-0"} />
              <span className={`text-[11px] font-bold tracking-wide whitespace-nowrap transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0 lg:opacity-0"}`}>
                {label}
              </span>
              {active && <div className="ml-auto w-1 h-1 rounded-full bg-[#3b82f6] flex-shrink-0" />}
            </button>
          );
        })}
      </div>
      <div className={`p-3 border-t border-[#1a2744] transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}>
        <p className="text-[9px] text-[#2a3a5a] text-center leading-relaxed">
          ML MODEL v2.0<br />Random Forest + GradientBoost
        </p>
      </div>
    </aside>
  );
}
