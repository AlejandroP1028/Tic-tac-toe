import React from "react";
import BoxParent from "@/components/BoxParent";
import { SiNextdotjs, SiGreensock } from "react-icons/si";

const page = () => {
  return (
    <div className="w-screen h-screen flex flex-col justify-center items-center space-y-10">
      <h1 className="text-4xl font-medium">Alejandro&apos;s Tic-Tac-Toe</h1>
      <BoxParent />
      <div className="text-lg flex flex-col items-center">
        <h4 className="font-semibold">Built with:</h4>
        <div className="flex flex-row gap-4 items-center mt-4">
          <div className="flex flex-row gap-2 items-center">
            {" "}
            <SiNextdotjs className="w-8 h-8 text-black" title="Next.js" />
          </div>
          <div className="flex flex-row gap-2 items-center">
            {" "}
            <SiGreensock className="w-8 h-8 text-black" title="GSAP" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default page;
