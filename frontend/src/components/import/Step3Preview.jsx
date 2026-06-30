import DryRunPreview from '../dryRunPreview.jsx';
import PlaylistNamingCard from './review/PlaylistNamingCard.jsx';
import './Step3Preview.css';

/**
 * Step3Preview — dry-run preview + AI naming panel.
 */
export default function Step3Preview({
  pendingMatches,
  resolveResults,
  selectedPlaylistId,
  suggestedName,
  suggestedDesc,
  exactTrackIds,
  nearDuplicateTrackIds,
  onManualSearch,
  onBack,
  onConfirmAll,
  onFinalizeImport,
  setSuggestedName,
  setSuggestedDesc,
  setPendingMatches,
}) {
  const hasPlaylist = Boolean(selectedPlaylistId && selectedPlaylistId !== 'custom');

  if (pendingMatches) {
    return (
      <PlaylistNamingCard
        suggestedName={suggestedName}
        suggestedDesc={suggestedDesc}
        selectedPlaylistId={selectedPlaylistId}
        onNameChange={setSuggestedName}
        onDescChange={setSuggestedDesc}
        onBack={() => setPendingMatches(null)}
        onFinalize={() => {
          onFinalizeImport(pendingMatches);
          setPendingMatches(null);
        }}
      />
    );
  }


  return (
    <DryRunPreview
      resolvedMatches={resolveResults}
      onConfirm={onConfirmAll}
      onManualSearch={onManualSearch}
      onBack={onBack}
      exactTrackIds={exactTrackIds}
      nearDuplicateTrackIds={nearDuplicateTrackIds}
      hasPlaylist={hasPlaylist}
    />
  );
}
