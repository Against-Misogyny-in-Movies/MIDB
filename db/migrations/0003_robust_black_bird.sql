-- Custom SQL migration file, put you code below! ---- Custom SQL migration file, put you code below! --
INSERT INTO METRICS (
    id, 
    name, 
    short_description, 
    related_options, 
    description
    
) 
VALUES (
    'bechdel',
    'Bechdel Test',
    'The Bechdel test assesses gender representation in media. It passes if two named female characters have a conversation not centered on men.',
    true,
    '**Detailed Description:**

The Bechdel test, created by American cartoonist Alison Bechdel in 1985, is a widely recognized method for evaluating gender representation in movies and other media. It consists of three simple criteria that a work of fiction must meet to pass the test:

1. The work must have at least two named female characters: To fulfill this criterion, a story should feature two or more female characters who are distinct individuals with names. These characters can be major protagonists or minor supporting roles.

2. These female characters must have a conversation with each other: The test requires that the named female characters engage in a meaningful conversation. It can be a brief exchange or a more extended dialogue, but the key is that they interact directly with each other.

3. The conversation should not revolve around a man: This is the central point of the Bechdel test. The conversation between the female characters should focus on a topic other than male characters or romantic interests. It can be about their careers, hobbies, friendships, family, or any other subject that doesn't center on men.

It\'s important to note that passing the Bechdel test doesn\'t necessarily mean a work is feminist or free from gender biases. It\'s a basic indicator of whether women are present and engage in meaningful interactions in the narrative. Many works that fail the Bechdel test still provide valuable insights into gender dynamics and issues.

The Bechdel test has sparked discussions about gender representation in the media and the need for more diverse and nuanced portrayals of women. While it's a useful tool for raising awareness, it's just one aspect of a broader conversation about equality and inclusivity in storytelling.

In your movie rating website, you can use the Bechdel test as a valuable metric to assess the gender diversity and representation in the films you review. It can help users identify works that meet these criteria and promote discussions about gender equality in cinema.
'

)
;

INSERT INTO METRIC_OPTIONS (
    metric_id,
    name,
    short_description
) VALUES (
    'bechdel',
    'At least two woman with a name',
    'The work must have at least two named female characters: To fulfill this criterion, a story should feature two or more female characters who are distinct individuals with names. These characters can be major protagonists or minor supporting roles.'
), (
    'bechdel',
    'Talking to each other',
    'These female characters must have a conversation with each other: The test requires that the named female characters engage in a meaningful conversation. It can be a brief exchange or a more extended dialogue, but the key is that they interact directly with each other'
), (
    'bechdel',
    'Not about a male charakter',
    `The conversation between the female characters should focus on a topic other than male characters or romantic interests. It can be about their careers, hobbies, friendships, family, or any other subject that doesn't center on men.`
)
;