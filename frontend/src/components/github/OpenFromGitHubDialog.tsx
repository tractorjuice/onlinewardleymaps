import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import React, {FunctionComponent, useState} from 'react';
import {parseGitHubUrl, sourceToId} from '../../repository/github/GitHubUrl';
import {getGitHubToken, setGitHubToken} from '../../repository/github/GitHubToken';

interface OpenFromGitHubDialogProps {
    open: boolean;
    onClose: () => void;
    onOpen: (id: string) => void;
}

const OpenFromGitHubDialog: FunctionComponent<OpenFromGitHubDialogProps> = ({open, onClose, onOpen}) => {
    const hasToken = getGitHubToken() !== null;
    const [url, setUrl] = useState('');
    const [token, setToken] = useState('');
    const [error, setError] = useState('');

    const handleOpen = () => {
        const source = parseGitHubUrl(url);
        if (!source) {
            setError('That is not a valid GitHub file URL (expected .../blob/...).');
            return;
        }
        if (!hasToken && token.trim() === '') {
            setError('A personal access token is required.');
            return;
        }
        if (token.trim() !== '') setGitHubToken(token);
        setError('');
        onOpen(sourceToId(source));
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Open map from GitHub</DialogTitle>
            <DialogContent>
                <DialogContentText sx={{mb: 2}}>
                    Paste a link to a Markdown file containing a Mermaid <code>wardley-beta</code> block.
                </DialogContentText>
                <TextField
                    autoFocus
                    fullWidth
                    margin="dense"
                    label="GitHub file URL"
                    placeholder="https://github.com/owner/repo/blob/branch/path.md"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                />
                {!hasToken && (
                    <TextField
                        fullWidth
                        margin="dense"
                        type="password"
                        label="Personal access token"
                        helperText={
                            <>
                                Needs Contents: read &amp; write.{' '}
                                <Link href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noreferrer">
                                    Create one
                                </Link>
                                .
                            </>
                        }
                        value={token}
                        onChange={e => setToken(e.target.value)}
                    />
                )}
                {error !== '' && (
                    <DialogContentText color="error" sx={{mt: 1}}>
                        {error}
                    </DialogContentText>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleOpen} variant="contained">
                    Open
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default OpenFromGitHubDialog;
