"use client";

import React, { useMemo, useState } from "react";

type Section = {
  id: string;
  title: string;
  body: React.ReactNode;
};

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      className={`inline-block transition-transform duration-200 ${
        open ? "rotate-180" : "rotate-0"
      }`}
      aria-hidden="true"
    >
      ▼
    </span>
  );
}

export default function WhitepaperPage() {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(["abstract"]));

  const sections: Section[] = useMemo(
    () => [
      {
        id: "abstract",
        title: "Abstract",
        body: (
          <div className="space-y-4 text-slate-700 leading-relaxed">
            <p>
              NFTBingo is a blockchain-enabled bingo platform designed to modernize traditional bingo
              gameplay while preserving the fairness, accessibility, and social engagement that define the
              game. By representing bingo cards as reusable non-fungible tokens (NFTs), the platform
              introduces digital ownership, automated verification, and transparent prize distribution without
              altering core bingo mechanics or creating pay-to-win dynamics.
            </p>
            <p>
              The platform supports continuous online gameplay through a rolling game model, with
              automated number drawing, provable randomness, and deterministic resolution. Players remain
              actively engaged by recognizing winning patterns and manually calling bingo, following
              traditional number-based resolution rules rather than speed-based interaction. All cards have
              identical odds of winning, and no gameplay advantages are conferred through card ownership
              or purchase.
            </p>
            <p>
              NFTBingo incorporates a pricing model that anchors game buy-ins to a target real-world value,
              ensuring consistency and clarity for participants despite token market volatility. Prize pools may
              include digital assets or non-platform rewards, with all distributions enforced automatically and
              transparently.
            </p>
            <p>
              Beyond gameplay, NFTBingo functions as an engagement and distribution platform for creators
              and early-stage NFT projects. Through creator partnerships, background artwork is integrated
              into NFTBingo cards, and a portion of gameplay-generated revenue is allocated to acquiring
              partner project NFTs from secondary markets. These acquired assets are redistributed as
              prizes, creating sustained liquidity support for partnered projects while providing players with
              externally valuable rewards.
            </p>
            <p>
              The platform is designed for extensibility into physical bingo halls and community venues using
              standard consumer hardware. Digital card management and automated verification reduce
              reliance on paper cards, dobbers, and ink, lowering operational overhead while maintaining
              familiar bingo experiences. Venue operators retain control over interaction styles and
              configurations to align with local preferences and regulatory requirements.
            </p>
            <p>
              By combining proven bingo mechanics with digital infrastructure, NFTBingo establishes a
              scalable, fair, and adaptable foundation for both online and physical bingo environments,
              supporting players, creators, and operators through a single integrated system.
            </p>
          </div>
        ),
      },

      {
        id: "1",
        title: "1. Project Scope & Vision",
        body: (
          <div className="space-y-6 text-slate-700 leading-relaxed">
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">1.1 Motivation and Problem Statement</h3>
              <p>
                Bingo is one of the most widely played and socially accessible games in the world, yet its
                underlying infrastructure has remained largely unchanged for decades. Most bingo halls
                continue to rely on paper cards, manual verification, and fragmented payout systems that limit
                scalability, transparency, and player engagement.
              </p>
              <p>This legacy model creates several persistent problems:</p>
              <ul className="space-y-2">
                <li>● Operational inefficiency: Paper card printing, manual game validation, and cash-based prize handling increase overhead and error rates.</li>
                <li>● Limited scalability: Physical halls are constrained by seating, staffing, and manual processes.</li>
                <li>● Trust and verification challenges: Players must rely on human verification for winning claims, creating disputes and delays.</li>
                <li>● Lack of digital ownership: Players have no persistent or transferable value from purchased bingo cards.</li>
                <li>● Disconnected ecosystems: Physical bingo halls, online bingo platforms, and digital assets operate in isolation with no shared infrastructure.</li>
              </ul>
              <p>
                At the same time, most online bingo platforms are centralized systems that replicate paper
                bingo digitally without offering meaningful innovation, transparency, or player ownership.
              </p>
              <p>
                NFTBingo is being developed to address these limitations directly by modernizing bingo
                infrastructure while preserving the simplicity and social appeal that make the game enduring.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">1.2 Core Scope of the Platform</h3>
              <p>
                NFTBingo introduces a blockchain-native bingo system where bingo cards are represented as
                NFTs and gameplay is enforced through smart contracts. The platform is designed to function
                as:
              </p>
              <ul className="space-y-2">
                <li>● A continuous online bingo hall with automated game creation and payouts</li>
                <li>● A digital asset ecosystem where bingo cards have persistent ownership and utility</li>
                <li>● A programmable prize system supporting tokens, NFTs, and wrapped cryptocurrencies</li>
                <li>● A scalable foundation capable of extending beyond a single website or application</li>
              </ul>
              <p>The scope of the initial platform includes:</p>
              <ul className="space-y-2">
                <li>● NFT-based bingo cards used as entry assets for all games</li>
                <li>● Rolling blocks of concurrent games to ensure constant availability</li>
                <li>● USD-pegged buy-ins converted to tokens via price snapshots for pricing stability</li>
                <li>● Player-unlimited games, player-capped games, and featured jackpot games</li>
                <li>● Automated prize distribution using smart contracts</li>
                <li>● Optional NFT card staking and revenue-sharing mechanics</li>
              </ul>
              <p>
                The platform is intentionally designed to separate game logic, asset ownership, and pricing
                mechanics, allowing each component to evolve independently without disrupting the
                ecosystem.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">1.3 Problems NFTBingo Solves</h3>
              <p>
                NFTBingo is not simply a digital bingo game; it is an infrastructure upgrade for how bingo can
                operate in the modern era.
              </p>
              <p>The platform addresses:</p>
              <ul className="space-y-2">
                <li>● Fairness: Provably verifiable game outcomes and automated payouts remove human error and bias.</li>
                <li>● Transparency: All game rules, buy-ins, and prize distributions are enforceable and auditable.</li>
                <li>● Player Ownership: Bingo cards become ownable, transferable assets rather than disposable paper products.</li>
                <li>● Economic Flexibility: Prize pools can include multiple digital assets without altering core game mechanics.</li>
                <li>● Accessibility: Players can participate remotely without geographic or physical limitations.</li>
                <li>● Operational Cost Reduction: Automation reduces staffing, printing, and reconciliation overhead.</li>
              </ul>
              <p>These improvements benefit not only players, but also operators and organizers who need reliable, scalable systems.</p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">
                1.4 Expansion Beyond the Platform: Modernizing Physical Bingo
              </h3>
              <p>
                A core long-term objective of NFTBingo is to bridge digital and physical bingo, not replace
                one with the other.
              </p>
              <p>
                The architecture is being designed so that NFTBingo cards and game logic can extend into
                traditional bingo halls, enabling:
              </p>
              <ul className="space-y-2">
                <li>● Digital verification of paper or hybrid cards</li>
                <li>● Automated prize validation and payout tracking</li>
                <li>● Reduced disputes and faster game resolution</li>
                <li>● Optional digital wallets for prize handling</li>
                <li>● Hybrid games where physical players and online players participate simultaneously</li>
              </ul>
              <p>Under this model, a bingo hall could:</p>
              <ul className="space-y-2">
                <li>● Issue NFT-backed bingo cards alongside or instead of paper cards</li>
                <li>● Use the NFTBingo system to verify winners instantly</li>
                <li>● Offer digital prizes or cross-hall jackpots</li>
                <li>● Retain their physical social environment while benefiting from modern infrastructure</li>
              </ul>
              <p>
                This approach allows bingo halls to modernize incrementally rather than requiring a full
                transition to online-only systems.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">1.5 Long-Term Vision</h3>
              <p>
                NFTBingo is envisioned as a foundational bingo protocol, not just a single gaming website.
              </p>
              <p>Long-term expansion possibilities include:</p>
              <ul className="space-y-2">
                <li>● Licensing the platform to bingo halls and organizations</li>
                <li>● White-labeled deployments for charities, events, or private halls</li>
                <li>● Cross-hall jackpot systems shared between physical and online venues</li>
                <li>● Mobile and kiosk integrations for in-person games</li>
                <li>● Governance-driven game configuration and community-led events</li>
              </ul>
              <p>
                By decoupling bingo mechanics from paper systems and central databases, NFTBingo aims to
                bring bingo into the 21st century while respecting the traditions that made it popular in the first
                place.
              </p>
            </div>
          </div>
        ),
      },

      {
        id: "2",
        title: "2. Platform Overview",
        body: (
          <div className="space-y-6 text-slate-700 leading-relaxed">
            <p>
              This section provides a high-level overview of the NFTBingo platform, its primary components,
              and how participants interact with the system. It is intended to describe what the platform is and
              how it functions from a user and operator perspective, without delving into detailed technical
              implementation, economic formulas, or smart contract architecture, which are addressed in later
              sections.
            </p>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">2.1 Core Platform Components</h3>
              <p>
                NFTBingo is composed of several interrelated components that together enable decentralized,
                automated bingo gameplay.
              </p>
              <p>At a high level, the platform consists of:</p>
              <ul className="space-y-2">
                <li>● NFTBingo Cards, which serve as the primary participation asset</li>
                <li>● Bingo Games, which are continuously created and resolved through automated systems</li>
                <li>● A Native Utility Token, used for game entry and platform economics</li>
                <li>● Prize Assets, which may include tokens, NFTs, or partner-provided rewards</li>
                <li>● Platform Infrastructure, responsible for game coordination, fairness enforcement, and payout execution</li>
              </ul>
              <p>
                Each component is designed to operate independently while remaining interoperable, allowing
                the platform to evolve without disrupting existing gameplay or ownership structures.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">2.2 NFTBingo Cards</h3>
              <p>
                NFTBingo cards are persistent, ownable digital assets represented as non-fungible tokens.
                Each card functions as a reusable entry asset that allows a player to participate in bingo games
                on the platform.
              </p>
              <p>
                A card may be used to enter one active game at a time and is returned to the owner upon
                completion of that game. Cards are not consumed or destroyed through gameplay and may be
                reused indefinitely, subject to platform rules.
              </p>
              <p>
                Cards may feature distinct visual designs or collectible aesthetics; however, these visual
                differences are purely cosmetic and have no effect on gameplay.
              </p>
              <p>All NFTBingo cards have identical odds of winning.</p>
              <p>
                No card, edition, class, or visual variation will ever alter the probability of winning a bingo game.
                Winning outcomes are determined solely by the game’s random draw process and the numbers
                generated on each card, which are created fairly and uniformly.
              </p>
              <p>
                NFTBingo does not support pay-to-win mechanics. Any differences between card types are
                limited to economic or participation features and never affect gameplay outcomes.
              </p>
              <p>
                The platform may introduce limited card classes, such as Founder Edition cards, which may
                carry economic or participation advantages. These advantages are explicitly restricted from
                influencing winning odds, and specific benefits may evolve over time.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">2.3 Game Types and Availability</h3>
              <p>
                The platform supports multiple game types designed to accommodate different play styles and
                participation levels.
              </p>
              <p>Game types may include:</p>
              <ul className="space-y-2">
                <li>● Standard Games, which are broadly accessible and form the core of ongoing gameplay</li>
                <li>● Player-Capped Games, which limit participation to a fixed number of cards</li>
                <li>● Featured Games, which may offer special prize pools, formats, or sponsored rewards</li>
              </ul>
              <p>
                Players select games based on availability, entry requirements, and personal preference. All
                game types follow the same core fairness rules and automated enforcement mechanisms.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">2.4 Rolling Game Block Model</h3>
              <p>
                NFTBingo operates using a rolling game block model rather than isolated, one-off games. At
                any given time, the platform maintains a pool of active games that players can join.
              </p>
              <p>
                The size of this pool is dynamic, adjusting based on platform usage and participation levels. As
                games complete, new games are automatically introduced to maintain consistent availability
                while avoiding underfilled or inactive games.
              </p>
              <p>
                During periods of high activity, additional concurrent games may be created to reduce wait times
                and distribute participation. During lower activity periods, the number of active games may
                contract to ensure healthy prize pools and meaningful competition.
              </p>
              <p>
                This adaptive model ensures that the platform remains responsive, efficient, and continuously
                active without requiring manual oversight.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">2.5 Game Entry and Participation</h3>
              <p>
                From a player perspective, participation in NFTBingo is designed to be straightforward and
                intuitive.
              </p>
              <p>
                Players select an available game, designate an NFTBingo card for entry, and submit the
                required buy-in. Once entered, the card is locked to that game until completion. Games begin
                automatically once their participation and timing conditions are met.
              </p>
              <p>
                As numbers are drawn, they are automatically applied to all eligible cards, removing the
                need for manual number marking and allowing players to participate across multiple games
                without mechanical burden.
              </p>
              <p>
                While number marking is automated, players remain responsible for recognizing and
                claiming winning patterns. When a card completes a valid bingo pattern, the player must
                actively call “BINGO!” through the platform to register a claim.
              </p>
              <p>
                Winning claims follow traditional bingo resolution rules, where eligibility is determined by the
                number on which a winning pattern occurs rather than reaction speed. Multiple cards completing
                a winning pattern on the same number share the prize evenly, and delayed claims may be
                resolved alongside winners on a subsequent number, consistent with established bingo
                conventions.
              </p>
              <p>
                All claims are automatically validated, and game resolution and prize distribution are handled by
                the platform, ensuring fairness, accessibility, and a familiar bingo experience.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">2.6 Prizes and Rewards</h3>
              <p>
                NFTBingo supports flexible prize structures to enable a wide range of game formats and
                partnerships.
              </p>
              <p>Prizes may include:</p>
              <ul className="space-y-2">
                <li>● The platform’s native utility token</li>
                <li>● Other major digital assets</li>
                <li>● NFT-based rewards</li>
                <li>● Sponsored or partner-provided prizes</li>
              </ul>
              <p>
                Prize composition may vary by game type and event. All prize distribution is handled
                automatically upon game completion, ensuring timely and transparent payouts.
              </p>
              <p>
                Specific prize mechanics and allocation models are discussed in later sections of this document.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">2.7 Automation, Randomness, and Fairness</h3>
              <p>
                All core gameplay processes on the NFTBingo platform are automated and enforced through
                smart contracts, minimizing the need for manual intervention.
              </p>
              <p>
                Both bingo card generation and number drawing rely on random processes designed to be
                fair, unbiased, and unpredictable. Each card is generated independently with uniform number
                distribution, and game numbers are drawn in a manner that cannot be influenced by players or
                operators.
              </p>
              <p>
                Randomness and game outcomes are provable and verifiable, allowing games to be audited
                and ensuring that results cannot be manipulated once a game begins.
              </p>
              <p>
                Once initiated, a game’s outcome is deterministic and final. Payouts are executed automatically
                based on verified results, reducing disputes and increasing trust across the platform.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">2.8 Extensibility and Access Interfaces</h3>
              <p>
                NFTBingo is designed as an interface-agnostic platform capable of supporting multiple access
                methods.
              </p>
              <p>
                Primary access is provided through web-based interfaces, with future support for mobile
                applications and controlled physical terminals. In physical environments, the platform may
                operate on standard consumer hardware such as tablets, touchscreens, or existing computers
                configured in a controlled or kiosk-style mode.
              </p>
              <p>
                No proprietary or specialized hardware is required, allowing physical bingo halls and event
                organizers to adopt digital functionality without significant upfront investment.
              </p>
              <p>
                This flexible architecture supports future expansion into creator-driven events, partner
                integrations, and physical bingo environments while maintaining a consistent underlying system.
              </p>
            </div>
          </div>
        ),
      },

      {
        id: "3",
        title: "3. Game Architecture and Flow",
        body: (
          <div className="space-y-6 text-slate-700 leading-relaxed">
            <p>
              This section describes the lifecycle of a bingo game on the NFTBingo platform, focusing on how
              games transition between states, how winning conditions are resolved, and how outcomes are
              finalized. Detailed discussions of card design, fairness principles, and player interaction are
              addressed in earlier sections and are not repeated here.
            </p>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">3.1 Game Lifecycle Overview</h3>
              <p>Each bingo game progresses through a defined sequence of states:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Creation</li>
                <li>Open Entry</li>
                <li>Active Play</li>
                <li>Resolution</li>
                <li>Finalization</li>
              </ol>
              <p>
                State transitions occur automatically based on predefined conditions and cannot be altered
                once triggered.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">3.2 Game Creation and Entry Phase</h3>
              <p>
                Games are created automatically as part of the rolling game block system. Upon creation, each
                game is initialized with fixed parameters such as entry requirements, prize structure, and
                participation limits.
              </p>
              <p>
                During the entry phase, players may commit NFTBingo cards and submit the required buy-in.
                Once a game transitions to active play, entry is closed and all participating cards are finalized for
                that game instance.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">3.3 Active Play and Number Progression</h3>
              <p>
                When a game enters active play, numbers are drawn sequentially according to the game’s
                ruleset. Each draw represents a discrete resolution step and may result in one or more cards
                completing valid winning patterns.
              </p>
              <p>
                As numbers are drawn, card states are evaluated continuously to determine claim eligibility for
                the current draw window.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">3.4 Claim Windows and Win Resolution</h3>
              <p>
                Winning eligibility is determined by the number on which a valid bingo pattern is completed. All
                cards completing a winning pattern on the same number are considered simultaneous winners.
              </p>
              <p>
                Players must actively claim eligible wins by calling “BINGO” through the platform. Claims are
                validated to ensure that patterns are legitimate and that resolution rules are applied consistently.
              </p>
              <p>
                If a winning pattern is not claimed before the next number is drawn, resolution may include any
                additional winners completing patterns on that subsequent number, consistent with traditional
                bingo conventions.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">3.5 Prize Allocation and Game Conclusion</h3>
              <p>
                If a single card completes and claims a winning pattern within a draw window, it receives the full
                prize. If multiple cards complete winning patterns on the same number, the prize is split evenly
                among those winners.
              </p>
              <p>
                Once a winning condition is resolved, the game concludes and no further numbers are drawn.
                All committed cards are released back to their owners and may be reused in future games.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">3.6 Outcome Finality and Integrity</h3>
              <p>
                Game outcomes are final once resolved. All resolution logic follows deterministic rules based on
                verified randomness, finalized card states, and validated claims.
              </p>
              <p>
                The platform does not permit post-resolution modification, operator intervention, or discretionary
                overrides. This ensures consistent outcomes across all games regardless of participation scale
                or external conditions.
              </p>
            </div>
          </div>
        ),
      },

      {
        id: "4",
        title: "4. NFTBingo Cards",
        body: (
          <div className="space-y-6 text-slate-700 leading-relaxed">
            <p>
              NFTBingo cards are the core participation asset of the platform. This section defines how cards
              are created, owned, used, and managed over time, independent of specific game instances.
            </p>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">4.1 Card Definition and Ownership</h3>
              <p>
                Each NFTBingo card is a non-fungible token that represents the right to participate in bingo
                games on the platform. Cards are owned directly by players and are transferable unless
                otherwise restricted by specific card classes or event rules.
              </p>
              <p>
                Ownership of a card conveys full control over its use, including the ability to enter games, hold
                the asset for future participation, or transfer it to another party.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">4.2 Card Generation and Structure</h3>
              <p>
                Cards are generated using random and uniform processes to ensure fair number distribution.
                Each card is created independently and does not influence, nor is it influenced by, other cards.
              </p>
              <p>
                Card structure is fixed at creation and remains unchanged throughout its lifetime. Once
                generated, a card’s numbers and layout cannot be modified.
              </p>
              <p>
                Visual presentation and artwork may vary between cards, but these visual elements do not
                affect gameplay or winning probability.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">4.3 Card Usage and Game Commitment</h3>
              <p>
                A card may be committed to a single active game at a time. While committed, the card is
                temporarily locked and cannot be transferred or entered into another game.
              </p>
              <p>
                Once the game concludes, the card is released back to the owner and becomes immediately
                available for reuse in subsequent games.
              </p>
              <p>
                Cards are not consumed, burned, or degraded through gameplay and are designed to function
                as persistent, reusable assets.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">4.4 Card Classes and Utility Distinctions</h3>
              <p>
                All NFTBingo cards share identical gameplay odds. No card, edition, or class alters the
                probability of winning a game.
              </p>
              <p>
                The platform supports distinct card classes that may provide differences in economic or
                participation utility, such as revenue sharing or access-related benefits. These distinctions are
                strictly limited to non-gameplay mechanics and do not influence game outcomes.
              </p>
              <p>
                Founder Edition cards are a limited class of NFTBingo cards that provide additional
                economic benefits compared to standard cards. These benefits do not affect winning
                probability or gameplay mechanics.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">4.5 Staking, Lending, and Delegated Use</h3>
              <p>
                The platform may support mechanisms that allow card owners to grant limited usage rights to
                others without transferring ownership. This may include staking, lending, or delegated
                participation models.
              </p>
              <p>
                Under such models, the card owner retains ownership while allowing another participant to use
                the card for gameplay under predefined terms. Revenue or rewards generated through
                delegated use may be shared according to platform rules.
              </p>
              <p>
                These mechanisms are optional and do not affect the core gameplay mechanics or fairness
                guarantees.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">4.6 Long-Term Card Utility</h3>
              <p>
                NFTBingo cards are designed as long-lived assets rather than disposable entries. Beyond direct
                gameplay, cards may support future platform features such as special event eligibility,
                creator-sponsored games, or physical bingo hall integrations.
              </p>
              <p>
                By separating card ownership from individual game instances, the platform enables persistent
                utility while maintaining consistent and fair gameplay across all participants.
              </p>
            </div>
          </div>
        ),
      },

      {
        id: "5",
        title: "5. Economic Model and Buy-In Stability",
        body: (
          <div className="space-y-6 text-slate-700 leading-relaxed">
            <p>
              This section describes the economic principles that govern participation, pricing consistency,
              and value flow on the NFTBingo platform. It focuses on how games are priced, how value
              moves through the system, and how long-term sustainability is maintained, without specifying
              fixed numerical parameters.
            </p>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">5.1 Design Goals</h3>
              <p>The NFTBingo economic model is designed around the following core goals:</p>
              <ul className="space-y-2">
                <li>● Pricing clarity for players</li>
                <li>● Consistency across market conditions</li>
                <li>● Fair and transparent value distribution</li>
                <li>● Long-term platform sustainability</li>
              </ul>
              <p>These goals guide all buy-in, payout, and fee mechanisms on the platform.</p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">5.2 Buy-Ins and Pricing Stability</h3>
              <p>
                Game buy-ins are defined relative to a target fiat-denominated value, allowing players to
                understand the real-world cost of participation regardless of market volatility.
              </p>
              <p>
                At the time of game entry, the required amount of the platform’s native utility token is calculated
                based on current pricing data. This ensures that all participants in a given game commit an
                equivalent value, even as token prices fluctuate over time.
              </p>
              <p>Once a game begins, buy-in values are fixed for that game instance and cannot change.</p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">5.3 Native Utility Token Usage</h3>
              <p>
                The platform’s native utility token is used as the primary medium for game entry and internal
                economic accounting.
              </p>
              <p>Tokens are used to:</p>
              <ul className="space-y-2">
                <li>● Enter bingo games</li>
                <li>● Fund prize pools</li>
                <li>● Support platform operations</li>
                <li>● Enable additional economic features such as card-based benefits</li>
              </ul>
              <p>
                The token functions as a utility mechanism within the platform rather than a speculative
                instrument.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">5.4 Prize Pool Formation and Distribution</h3>
              <p>
                Prize pools are formed from player buy-ins and, where applicable, platform or partner
                contributions.
              </p>
              <p>
                Upon game resolution, prize pools are distributed automatically to winning participants
                according to the game’s resolution rules. In games with multiple winners, prizes are split evenly
                among all eligible winners.
              </p>
              <p>All prize distribution follows deterministic rules and is executed without discretionary control.</p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">5.5 Platform Fees and Sustainability</h3>
              <p>
                The platform may retain a portion of game activity as a fee to support ongoing development,
                infrastructure costs, and ecosystem growth.
              </p>
              <p>Fee structures are designed to be:</p>
              <ul className="space-y-2">
                <li>● Transparent</li>
                <li>● Predictable</li>
                <li>● Independent of gameplay outcomes</li>
              </ul>
              <p>Fees do not influence card odds, number draws, or game resolution.</p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">5.6 Founder and Card-Based Economic Benefits</h3>
              <p>
                Certain card classes may provide economic advantages within the platform, such as enhanced
                revenue sharing or fee-related benefits, without affecting gameplay outcomes.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">5.7 Economic Integrity and Fairness</h3>
              <p>
                All economic interactions on the platform are governed by predefined rules and enforced
                automatically.
              </p>
              <p>Once a game begins:</p>
              <ul className="space-y-2">
                <li>● Buy-in values are fixed</li>
                <li>● Prize pools cannot be altered</li>
                <li>● Payout logic is deterministic</li>
              </ul>
              <p>
                This structure ensures that all participants are subject to the same economic conditions within a
                given game and that outcomes remain fair and auditable.
              </p>
            </div>
          </div>
        ),
      },

      {
        id: "6",
        title: "6. Creator and Project Launchpad",
        body: (
          <div className="space-y-6 text-slate-700 leading-relaxed">
            <p>
              NFTBingo is designed to function as an engagement and distribution platform not only for
              players, but also for creators and early-stage NFT projects. This section describes a creator
              partnership model that integrates third-party artwork directly into gameplay while providing
              sustainable liquidity and exposure for partnered projects.
            </p>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">6.1 Creator Partnership Model</h3>
              <p>
                The platform partners with creators and emerging NFT projects by licensing or commissioning
                background artwork used in the creation of NFTBingo cards.
              </p>
              <p>
                Each partnership may involve the release of a dedicated series of NFTBingo cards featuring
                artwork supplied by a specific creator or project. These cards function identically to standard
                cards in gameplay and do not alter winning odds or game mechanics.
              </p>
              <p>
                Cards created through creator partnerships are sold through the platform, with proceeds
                participating in the platform’s normal economic flow.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">6.2 Revenue Allocation and Floor Support</h3>
              <p>
                A defined portion of revenue generated through gameplay using creator-partnered cards is
                allocated to a project-specific support pool.
              </p>
              <p>
                This pool is used to actively purchase NFTs from the partnered project on secondary
                marketplaces, effectively sweeping available listings and supporting the project’s floor price.
              </p>
              <p>
                Acquired NFTs are held by the platform and may be redistributed as prizes in future games.
              </p>
              <p>This mechanism creates a recurring demand loop:</p>
              <ul className="space-y-2">
                <li>● Players purchase and use creator-branded bingo cards</li>
                <li>● Gameplay generates revenue</li>
                <li>● Revenue is partially allocated to acquire project NFTs</li>
                <li>● Acquired NFTs are reintroduced as prizes</li>
                <li>● Prize winners may hold or resell those NFTs on open marketplaces</li>
              </ul>
              <p>
                This model provides sustained liquidity support for partner projects rather than one-time mint
                revenue.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">6.3 Incentives for Creators and Projects</h3>
              <p>This structure offers multiple incentives for creators and early-stage projects:</p>
              <ul className="space-y-2">
                <li>● Ongoing secondary-market demand driven by platform activity</li>
                <li>● Exposure through repeated gameplay rather than single-point launches</li>
                <li>● Distribution of project NFTs to engaged participants instead of passive buyers</li>
                <li>● Reduced reliance on traditional marketing or speculative hype</li>
              </ul>
              <p>
                By tying support directly to gameplay activity, creator success becomes linked to player
                engagement rather than short-term sales volume.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">6.4 Incentives for Players</h3>
              <p>
                Players benefit from creator partnerships through access to additional prize types and
                participation in broader ecosystems.
              </p>
              <p>Creator-partnered prizes may include NFTs that:</p>
              <ul className="space-y-2">
                <li>● Have existing secondary-market value</li>
                <li>● Are usable or tradable outside the platform</li>
                <li>● Represent early access to emerging projects</li>
              </ul>
              <p>
                This allows players to earn assets with utility or resale potential beyond the NFTBingo
                ecosystem while participating in familiar gameplay.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">6.5 Separation from Gameplay Fairness</h3>
              <p>
                Creator partnerships and revenue allocation mechanisms do not alter bingo gameplay.
              </p>
              <p>
                All cards, including creator-branded cards, have identical odds of winning. Revenue allocation
                and prize sourcing occur independently of game resolution and do not influence number
                drawing, pattern detection, or claim validation.
              </p>
              <p>
                This separation ensures that creator participation enhances the platform without introducing
                pay-to-win mechanics or probabilistic advantages.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">6.6 Long-Term Ecosystem Impact</h3>
              <p>
                By combining gameplay-driven revenue with secondary-market acquisition, NFTBingo operates
                as a sustainable engagement loop for creators and players alike.
              </p>
              <p>This model allows the platform to:</p>
              <ul className="space-y-2">
                <li>● Support emerging projects without custodial control</li>
                <li>● Provide continuous prize variety without constant new minting</li>
                <li>● Align creator incentives with player participation</li>
                <li>● Reduce speculative pressure on initial NFT launches</li>
              </ul>
              <p>
                Over time, this positions NFTBingo as both a gaming platform and a liquidity-supporting
                distribution layer for creative ecosystems.
              </p>
            </div>
          </div>
        ),
      },

      {
        id: "7",
        title: "7. Risk, Compliance, and Operational Considerations",
        body: (
          <div className="space-y-6 text-slate-700 leading-relaxed">
            <p>
              This section outlines key considerations related to regulation, platform operation, and
              responsible deployment. NFTBingo is designed with awareness of the regulatory and
              operational environments in which bingo, digital assets, and online platforms operate.
            </p>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">7.1 Regulatory Awareness</h3>
              <p>
                Bingo is subject to varying legal and regulatory frameworks depending on jurisdiction. These
                frameworks may differ significantly between online platforms, charitable bingo operations, and
                physical bingo halls.
              </p>
              <p>
                NFTBingo is designed as a configurable platform capable of operating within different regulatory
                contexts. Game parameters, access methods, prize structures, and participation requirements
                may be adapted to comply with applicable local laws and regulations.
              </p>
              <p>
                The platform does not assume a single regulatory model and is intended to support
                jurisdiction-specific configurations where required.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">7.2 Distinction Between Gameplay and Wagering</h3>
              <p>
                NFTBingo maintains a clear separation between gameplay mechanics and economic
                distribution.
              </p>
              <p>
                Winning outcomes are determined exclusively by randomized number draws and validated
                bingo patterns. Economic participation, including buy-ins and prize allocation, is governed by
                predefined and transparent rules that do not influence gameplay odds.
              </p>
              <p>
                This separation reduces the risk of manipulation and supports compliance with jurisdictions that
                distinguish games of chance, games of skill, and promotional gaming activities.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">7.3 Player Fairness and Consumer Protection</h3>
              <p>
                The platform is designed to minimize unfair advantages related to speed, dexterity, or device
                capability.
              </p>
              <p>Key protections include:</p>
              <ul className="space-y-2">
                <li>● Uniform odds across all cards</li>
                <li>● Automated number application to cards</li>
                <li>● Number-based win resolution rather than reaction speed</li>
                <li>● Transparent prize structures disclosed prior to entry</li>
              </ul>
              <p>
                These measures are intended to support accessibility, fairness, and a consistent player
                experience.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">7.4 Operational Integrity and Reliability</h3>
              <p>
                NFTBingo relies on automated systems to manage game flow, resolution, and prize distribution.
                Once a game begins, outcomes cannot be altered through manual intervention.
              </p>
              <p>Operational safeguards are designed to address:</p>
              <ul className="space-y-2">
                <li>● Interrupted sessions</li>
                <li>● Delayed claims</li>
                <li>● Network or interface disruptions</li>
              </ul>
              <p>
                These safeguards ensure that games resolve deterministically and consistently, even under
                non-ideal conditions.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">7.5 Custody and Asset Handling</h3>
              <p>
                Players retain control over their assets through ownership of NFTBingo cards and receipt of
                prizes according to platform rules.
              </p>
              <p>
                The platform is designed to minimize custodial risk by limiting discretionary control over player
                assets and enforcing distribution through automated mechanisms.
              </p>
              <p>
                Specific custody models may vary depending on jurisdiction, access method, or integration type,
                particularly in physical or assisted environments.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">7.6 Evolving Regulatory Landscape</h3>
              <p>
                Regulation of digital assets, online gaming, and hybrid physical-digital platforms continues to
                evolve.
              </p>
              <p>
                NFTBingo is designed with adaptability in mind, allowing features, access methods, or
                participation rules to be modified or restricted as regulatory clarity develops. This flexibility
                supports responsible growth without requiring fundamental changes to core gameplay logic.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">7.7 Jurisdictional Access and Availability</h3>
              <p>
                Bingo and related gaming activities may be restricted or regulated differently across
                jurisdictions.
              </p>
              <p>
                NFTBingo is designed to respect applicable laws and regulations by limiting or modifying access
                where required. Platform availability, game types, prize structures, or participation mechanisms
                may be restricted, disabled, or adjusted based on jurisdictional requirements.
              </p>
              <p>
                The platform does not promote or facilitate participation in locations where such activity is
                prohibited and may implement access controls or alternative configurations to ensure
                responsible operation.
              </p>
            </div>
          </div>
        ),
      },

      {
        id: "8",
        title: "8. Physical Bingo Hall Integration and Future Deployment",
        body: (
          <div className="space-y-6 text-slate-700 leading-relaxed">
            <p>
              NFTBingo is designed to extend beyond a purely online platform and support integration with
              traditional bingo halls, community venues, and in-person events. This section outlines how the
              platform may be deployed in physical environments and how digital infrastructure can enhance,
              rather than replace, established bingo operations.
            </p>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">8.1 Hybrid Physical and Digital Gameplay</h3>
              <p>
                NFTBingo supports hybrid models where physical and digital participation coexist within the
                same game framework.
              </p>
              <p>In such models:</p>
              <ul className="space-y-2">
                <li>● Players may participate in-person or remotely</li>
                <li>● Games follow the same underlying rules and resolution logic</li>
                <li>● Winning verification and prize allocation are handled consistently across participation methods</li>
              </ul>
              <p>
                This approach allows physical bingo halls to modernize operations while preserving the social
                and community aspects that define traditional bingo.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">8.2 Low-Barrier Physical Deployment</h3>
              <p>Physical integration does not require proprietary or specialized hardware.</p>
              <p>
                NFTBingo is designed to operate on standard consumer devices, including tablets,
                touchscreens, or existing computers configured in controlled or kiosk-style modes. This enables
                bingo halls and event organizers to adopt digital functionality with minimal upfront cost.
              </p>
              <p>Deployment options may include:</p>
              <ul className="space-y-2">
                <li>● Front-of-house player terminals</li>
                <li>● Staff-operated verification stations</li>
                <li>● Event-specific or temporary setups</li>
              </ul>
              <p>This flexibility supports gradual adoption rather than mandatory infrastructure replacement.</p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">8.3 Manual Interaction and Venue Control</h3>
              <p>
                NFTBingo recognizes that physical bingo environments may prefer traditional interaction styles.
                Venues may configure games to enforce manual player actions, such as manual number
                marking or bingo calling, consistent with established hall practices. These configurations do not
                alter winning odds or game fairness and are applied uniformly across all participants within a
                given event.
              </p>
              <p>
                This allows venues to maintain familiar gameplay experiences while benefiting from automated
                verification and payout infrastructure.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">8.4 Prize Verification and Operational Benefits</h3>
              <p>By integrating NFTBingo into physical environments, venues may benefit from:</p>
              <ul className="space-y-2">
                <li>● Automated verification of winning patterns</li>
                <li>● Reduced disputes and faster resolution</li>
                <li>● Transparent prize tracking and distribution</li>
                <li>● Simplified record-keeping for events or fundraising</li>
              </ul>
              <p>
                These features reduce operational overhead while improving player trust and experience.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">8.5 Charity, Community, and Special Events</h3>
              <p>
                NFTBingo is well suited for charity bingo, community fundraising, and special events.
              </p>
              <p>Hybrid and physical deployments may support:</p>
              <ul className="space-y-2">
                <li>● Event-specific game configurations</li>
                <li>● Sponsored or donated prize pools</li>
                <li>● Transparent tracking of proceeds and outcomes</li>
              </ul>
              <p>
                This enables organizations to leverage modern infrastructure while maintaining the accessibility
                and familiarity of bingo.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">8.6 Future Expansion</h3>
              <p>Physical integration represents a long-term expansion path rather than an immediate requirement.</p>
              <p>As the platform evolves, NFTBingo may support:</p>
              <ul className="space-y-2">
                <li>● Additional venue configurations</li>
                <li>● Expanded access interfaces</li>
                <li>● Deeper integration with creator partnerships</li>
                <li>● New participation models aligned with regulatory requirements</li>
              </ul>
              <p>
                By designing physical integration as an extension of existing systems rather than a
                replacement, NFTBingo positions itself as a modernization layer adaptable to a wide range of
                environments.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">8.7 Operational Efficiency and Environmental Considerations</h3>
              <p>
                Traditional bingo operations rely heavily on disposable materials, including printed paper cards,
                ink-based dobbers, and associated supplies. These materials require continual replenishment,
                storage, transportation, and disposal, contributing to recurring operational costs and physical
                waste.
              </p>
              <p>
                By transitioning card issuance, number tracking, and win verification to a digital infrastructure,
                NFTBingo significantly reduces reliance on paper cards, dobbers, and ink. NFT-based bingo
                cards are reusable digital assets that eliminate the need for repeated printing and manual
                marking while preserving familiar gameplay patterns.
              </p>
              <p>
                For physical venues, this modernization can lower material expenses, simplify event logistics,
                and reduce waste without removing the social or interactive elements that define traditional
                bingo. Players continue to recognize patterns and call bingo, while venues benefit from
                automated verification and reduced consumable usage.
              </p>
              <p>
                These efficiency gains are a natural byproduct of digital integration and support environmentally
                conscious practices alongside improved operational consistency.
              </p>
            </div>
          </div>
        ),
      },
    ],
    []
  );

  const isOpen = (id: string) => openIds.has(id);

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setOpenIds(new Set(sections.map((s) => s.id)));
  const collapseAll = () => setOpenIds(new Set());

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100 px-6 py-14">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900">
            NFTBingo Whitepaper
          </h1>

          <p className="mt-4 text-slate-600 max-w-3xl mx-auto">
            Read the full whitepaper below, or download the PDF.
          </p>

          {/* Actions */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/whitepaper/NFTBingo-Whitepaper.pdf"
              download
              className="cursor-pointer bg-gradient-to-r from-pink-600 to-indigo-600 text-white font-semibold px-8 py-3 rounded-xl shadow hover:shadow-lg hover:scale-[1.02] transition-all duration-300"
            >
              Download PDF
            </a>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={expandAll}
                 className="cursor-pointer bg-gradient-to-r from-pink-600 to-indigo-600 text-white font-semibold px-8 py-3 rounded-xl shadow hover:shadow-lg hover:scale-[1.02] transition-all duration-300"
            >
                Expand all
              </button>
              <button
                type="button"
                onClick={collapseAll}
                 className="cursor-pointer bg-gradient-to-r from-pink-600 to-indigo-600 text-white font-semibold px-8 py-3 rounded-xl shadow hover:shadow-lg hover:scale-[1.02] transition-all duration-300"
            >
                Collapse all
              </button>
            </div>
          </div>
        </div>

        {/* Accordion */}
        <div className="space-y-4">
          {sections.map((section) => {
            const open = isOpen(section.id);
            return (
              <div
                key={section.id}
                className="bg-white rounded-2xl shadow border border-slate-100 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggle(section.id)}
                  className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 hover:bg-slate-50 transition"
                  aria-expanded={open}
                >
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full bg-gradient-to-r from-pink-600 to-indigo-600" />
                    <h2 className="text-lg md:text-xl font-extrabold text-slate-900">
                      {section.title}
                    </h2>
                  </div>
                  <Chevron open={open} />
                </button>

                {open && (
                  <div className="px-6 pb-6">
                    <div className="h-px bg-slate-100 mb-5" />
                    {section.body}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="mt-10 text-center text-sm text-slate-500">
          © 2025 NFTBingo • Built on Polygon • nftbingo.net
        </div>
      </div>
    </main>
  );
}
