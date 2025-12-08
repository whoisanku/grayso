import { createUserAssociation, identity } from "deso-protocol";

const APP_PUBLIC_KEY = "BC1YLjEayZDjAPitJJX4Boy7LsEfN3sWAkYb3hgE9kGBirztsc2re1N";

export const moveSpamInbox = async (
    userPublicKey: string,
    threadIdentifier: string,
    isSpam: boolean
) => {
    try {
        const response = await createUserAssociation({
            TransactorPublicKeyBase58Check: userPublicKey,
            TargetUserPublicKeyBase58Check: userPublicKey,
            AppPublicKeyBase58Check: APP_PUBLIC_KEY,
            AssociationType: "CUSTOM_MESSAGING_THREAD_SETTINGS",
            AssociationValue: threadIdentifier,
            ExtraData: {
                FeePerMessageUsdCents: isSpam ? "-1" : "0",
                Version: "0",
            },
            MinFeeRateNanosPerKB: 1000,
        });
        return response;
    } catch (error) {
        console.error("Error moving message to spam/inbox:", error);
        throw error;
    }
};
