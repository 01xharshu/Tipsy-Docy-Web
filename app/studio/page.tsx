"use client";
import dynamic from "next/dynamic";
import StudioLoading from "@/components/studio-loading";
const Workspace = dynamic(() => import("@/components/workspace"), {
  ssr: false,
  loading: () => <StudioLoading />,
});
export default function Studio() {
  return <Workspace />;
}
