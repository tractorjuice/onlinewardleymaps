import {fireEvent, render, screen} from '@testing-library/react';
import OpenFromGitHubDialog from './OpenFromGitHubDialog';
import {clearGitHubToken, getGitHubToken, setGitHubToken} from '../../repository/github/GitHubToken';

describe('OpenFromGitHubDialog', () => {
    afterEach(() => clearGitHubToken());

    it('rejects an invalid URL without calling onOpen', () => {
        const onOpen = jest.fn();
        setGitHubToken('ghp_token');
        render(<OpenFromGitHubDialog open onClose={jest.fn()} onOpen={onOpen} />);

        fireEvent.change(screen.getByLabelText(/github file url/i), {target: {value: 'not a url'}});
        fireEvent.click(screen.getByRole('button', {name: /^open$/i}));

        expect(onOpen).not.toHaveBeenCalled();
        expect(screen.getByText(/not a valid github/i)).toBeInTheDocument();
    });

    it('calls onOpen with the id and stores the PAT for a valid URL', () => {
        const onOpen = jest.fn();
        render(<OpenFromGitHubDialog open onClose={jest.fn()} onOpen={onOpen} />);

        fireEvent.change(screen.getByLabelText(/personal access token/i), {
            target: {value: 'ghp_new'},
        });
        fireEvent.change(screen.getByLabelText(/github file url/i), {
            target: {value: 'https://github.com/acme/maps/blob/main/docs/tea.md'},
        });
        fireEvent.click(screen.getByRole('button', {name: /^open$/i}));

        expect(onOpen).toHaveBeenCalledWith('acme/maps/main/docs/tea.md');
        expect(getGitHubToken()).toBe('ghp_new');
    });
});
