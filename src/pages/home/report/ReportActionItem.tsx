import React, {useMemo} from 'react';
import type {OnyxCollection, OnyxEntry} from 'react-native-onyx';
import {useBlockedFromConcierge} from '@components/OnyxListItemProvider';
import useOnyx from '@hooks/useOnyx';
import useReportIsArchived from '@hooks/useReportIsArchived';
import ModifiedExpenseMessage from '@libs/ModifiedExpenseMessage';
import {getIOUReportIDFromReportActionPreview, getOriginalMessage, isMoneyRequestAction} from '@libs/ReportActionsUtils';
import {
    chatIncludesChronosWithID,
    createDraftTransactionAndNavigateToParticipantSelector,
    getIndicatedMissingPaymentMethod,
    getOriginalReportID,
    getReimbursementDeQueuedOrCanceledActionMessage,
    getTransactionsWithReceipts,
    isArchivedNonExpenseReport,
    isChatThread,
    isClosedExpenseReportWithNoExpenses,
    isCurrentUserTheOnlyParticipant,
} from '@libs/ReportUtils';
import {
    deleteReportActionDraft,
    dismissTrackExpenseActionableWhisper,
    resolveActionableMentionWhisper,
    resolveActionableReportMentionWhisper,
    toggleEmojiReaction,
} from '@userActions/Report';
import {clearAllRelatedReportActionErrors} from '@userActions/ReportActions';
import {clearError} from '@userActions/Transaction';
import type CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Policy, Report, ReportAction, Transaction} from '@src/types/onyx';
import type {PureReportActionItemProps} from './PureReportActionItem';
import PureReportActionItem from './PureReportActionItem';

type ReportActionItemProps = Omit<PureReportActionItemProps, 'taskReport' | 'linkedReport' | 'iouReportOfLinkedReport'> & {
    /** All the data of the report collection */
    allReports: OnyxCollection<Report>;

    /** All the data of the policy collection */
    policies: OnyxCollection<Policy>;

    /** Whether to show the draft message or not */
    shouldShowDraftMessage?: boolean;

    /** All the data of the transaction collection */
    transactions?: Array<OnyxEntry<Transaction>>;
};

function ReportActionItem({allReports, policies, action, report, transactions, shouldShowDraftMessage = true, ...props}: ReportActionItemProps) {
    const reportID = report?.reportID;
    const originalMessage = getOriginalMessage(action);
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const originalReportID = useMemo(() => getOriginalReportID(reportID, action), [reportID, action]);
    const originalReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${originalReportID}`];
    const isOriginalReportArchived = useReportIsArchived(originalReportID);
    const [currentUserAccountID] = useOnyx(ONYXKEYS.SESSION, {canBeMissing: false, selector: (session) => session?.accountID});
    const [draftMessage] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS_DRAFTS}${originalReportID}`, {
        canBeMissing: true,
        selector: (draftMessagesForReport) => {
            if (!shouldShowDraftMessage) {
                return undefined;
            }
            const matchingDraftMessage = draftMessagesForReport?.[action.reportActionID];
            return typeof matchingDraftMessage === 'string' ? matchingDraftMessage : matchingDraftMessage?.message;
        },
    });
    const iouReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${getIOUReportIDFromReportActionPreview(action)}`];
    const [policy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`, {canBeMissing: true});
    const [emojiReactions] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS_REACTIONS}${action.reportActionID}`, {canBeMissing: true});
    const [userWallet] = useOnyx(ONYXKEYS.USER_WALLET, {canBeMissing: false});
    const [linkedTransactionRouteError] = useOnyx(`${ONYXKEYS.COLLECTION.TRANSACTION}${isMoneyRequestAction(action) && getOriginalMessage(action)?.IOUTransactionID}`, {
        canBeMissing: true,
        selector: (transaction) => transaction?.errorFields?.route ?? null,
    });

    const [isUserValidated] = useOnyx(ONYXKEYS.ACCOUNT, {selector: (account) => account?.validated, canBeMissing: true});
    // The app would crash due to subscribing to the entire report collection if parentReportID is an empty string. So we should have a fallback ID here.
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const parentReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${report?.parentReportID || undefined}`];
    const [personalDetails] = useOnyx(ONYXKEYS.PERSONAL_DETAILS_LIST, {canBeMissing: false});
    const blockedFromConcierge = useBlockedFromConcierge();
    const [userBillingFundID] = useOnyx(ONYXKEYS.NVP_BILLING_FUND_ID, {canBeMissing: true});
    const targetReport = isChatThread(report) ? parentReport : report;
    const missingPaymentMethod = getIndicatedMissingPaymentMethod(userWallet, targetReport?.reportID, action);

    const taskReport = originalMessage && 'taskReportID' in originalMessage ? allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${originalMessage.taskReportID}`] : undefined;
    const linkedReport = originalMessage && 'linkedReportID' in originalMessage ? allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${originalMessage.linkedReportID}`] : undefined;
    const iouReportOfLinkedReport = linkedReport && 'iouReportID' in linkedReport ? allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${linkedReport.iouReportID}`] : undefined;

    return (
        <PureReportActionItem
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...props}
            allReports={allReports}
            policies={policies}
            action={action}
            report={report}
            policy={policy}
            currentUserAccountID={currentUserAccountID}
            draftMessage={draftMessage}
            iouReport={iouReport}
            taskReport={taskReport}
            linkedReport={linkedReport}
            iouReportOfLinkedReport={iouReportOfLinkedReport}
            emojiReactions={emojiReactions}
            linkedTransactionRouteError={linkedTransactionRouteError}
            isUserValidated={isUserValidated}
            parentReport={parentReport}
            personalDetails={personalDetails}
            blockedFromConcierge={blockedFromConcierge}
            originalReportID={originalReportID}
            deleteReportActionDraft={deleteReportActionDraft}
            isArchivedRoom={isArchivedNonExpenseReport(originalReport, isOriginalReportArchived)}
            isChronosReport={chatIncludesChronosWithID(originalReportID)}
            toggleEmojiReaction={toggleEmojiReaction}
            createDraftTransactionAndNavigateToParticipantSelector={createDraftTransactionAndNavigateToParticipantSelector}
            resolveActionableReportMentionWhisper={resolveActionableReportMentionWhisper}
            resolveActionableMentionWhisper={resolveActionableMentionWhisper}
            isClosedExpenseReportWithNoExpenses={isClosedExpenseReportWithNoExpenses(iouReport, transactions)}
            isCurrentUserTheOnlyParticipant={isCurrentUserTheOnlyParticipant}
            missingPaymentMethod={missingPaymentMethod}
            reimbursementDeQueuedOrCanceledActionMessage={getReimbursementDeQueuedOrCanceledActionMessage(
                action as OnyxEntry<ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.REIMBURSEMENT_DEQUEUED | typeof CONST.REPORT.ACTIONS.TYPE.REIMBURSEMENT_ACH_CANCELED>>,
                report,
            )}
            modifiedExpenseMessage={ModifiedExpenseMessage.getForReportAction({reportOrID: reportID, reportAction: action})}
            getTransactionsWithReceipts={getTransactionsWithReceipts}
            clearError={clearError}
            clearAllRelatedReportActionErrors={clearAllRelatedReportActionErrors}
            dismissTrackExpenseActionableWhisper={dismissTrackExpenseActionableWhisper}
            userBillingFundID={userBillingFundID}
        />
    );
}

export default ReportActionItem;
