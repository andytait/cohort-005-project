import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  TabsContentNoShift,
} from "~/components/ui/tabs";
import type { getCountryTierInfo } from "~/lib/ppp";
import { formatPrice } from "~/lib/utils";

type TierInfo = ReturnType<typeof getCountryTierInfo>;

function PriceDisplay({
  price,
  pppPrice,
  tierInfo,
}: {
  price: number;
  pppPrice: number;
  tierInfo: TierInfo;
}) {
  const pppPriceLabel = formatPrice(pppPrice);
  const isDiscounted = pppPrice < price;

  return (
    <div className="mb-3 text-center">
      {isDiscounted ? (
        <>
          <div className="text-sm text-muted-foreground line-through">
            {formatPrice(price)}
          </div>
          <div className="text-2xl font-bold">{pppPriceLabel}</div>
          <div className="mt-1 inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
            {tierInfo.label}: PPP discount
          </div>
        </>
      ) : (
        <div className="text-2xl font-bold">{pppPriceLabel}</div>
      )}
    </div>
  );
}

export function EnrollOptions({
  price,
  pppPrice,
  tierInfo,
  selfPurchaseLink,
  teamPurchaseLink,
}: {
  price: number;
  pppPrice: number;
  tierInfo: TierInfo;
  selfPurchaseLink: string;
  teamPurchaseLink: string;
}) {
  const pppPriceLabel = formatPrice(pppPrice);

  const priceDisplay = (
    <PriceDisplay price={price} pppPrice={pppPrice} tierInfo={tierInfo} />
  );

  return (
    <Tabs defaultValue="self">
      <TabsList className="mb-4 w-full">
        <TabsTrigger value="self" className="flex-1 text-xs">
          Buy for Myself
        </TabsTrigger>
        <TabsTrigger value="team" className="flex-1 text-xs">
          Buy for Team
        </TabsTrigger>
      </TabsList>
      <TabsContentNoShift>
        <TabsContent value="self" forceMount>
          {priceDisplay}
          <Link to={selfPurchaseLink}>
            <Button size="lg" className="w-full">
              Enroll Now: {pppPriceLabel}
            </Button>
          </Link>
        </TabsContent>
        <TabsContent value="team" forceMount>
          {priceDisplay}
          <Link to={teamPurchaseLink}>
            <Button size="lg" variant="outline" className="w-full">
              Buy for Your Team
            </Button>
          </Link>
        </TabsContent>
      </TabsContentNoShift>
    </Tabs>
  );
}
